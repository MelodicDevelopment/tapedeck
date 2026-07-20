//! Hardware volume-key capture (macOS).
//!
//! macOS routes the keyboard volume/mute keys to the system mixer, never to
//! apps. With the user's one-time Accessibility permission, a session event
//! tap intercepts those keys while Tapedeck is the focused app with the
//! player open, forwarding them to the in-app volume bar instead of the
//! system volume. In every other situation the keys pass through untouched.
//! Without the permission the tap is skipped and nothing changes.

use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};

use tauri::{AppHandle, State};

pub struct VolumeKeysState {
    pub focused: AtomicBool,
    pub player_active: AtomicBool,
}

impl VolumeKeysState {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            focused: AtomicBool::new(true),
            player_active: AtomicBool::new(false),
        })
    }
}

/// The player screen reports when it is mounted so volume keys are only
/// captured while there is actually a volume bar to drive.
#[tauri::command]
pub fn media_set_player_active(state: State<Arc<VolumeKeysState>>, active: bool) {
    state.player_active.store(active, Ordering::Relaxed);
}

#[cfg(not(target_os = "macos"))]
pub fn init(_app: &AppHandle, _state: Arc<VolumeKeysState>) {}

#[cfg(target_os = "macos")]
pub fn init(app: &AppHandle, state: Arc<VolumeKeysState>) {
    macos::init(app.clone(), state);
}

#[cfg(target_os = "macos")]
// The objc 0.2 macros trip rustc's unexpected-cfgs lint; not actionable here.
#[allow(unexpected_cfgs)]
mod macos {
    use super::VolumeKeysState;
    use std::{
        ffi::c_void,
        ptr,
        sync::{atomic::Ordering, Arc},
    };

    use core_foundation::{
        base::TCFType,
        boolean::CFBoolean,
        dictionary::CFDictionary,
        runloop::{kCFRunLoopCommonModes, CFRunLoopAddSource, CFRunLoopGetCurrent, CFRunLoopRun},
        string::CFString,
    };
    use core_foundation::string::CFStringRef;
    use objc::{class, msg_send, rc::autoreleasepool, runtime::Object, sel, sel_impl};
    use serde_json::json;
    use tauri::{AppHandle, Emitter, Manager};

    type CGEventTapProxy = *const c_void;
    type CGEventRef = *mut c_void;
    type CFMachPortRef = *mut c_void;
    type CFRunLoopSourceRef = *mut c_void;

    // NSEventTypeSystemDefined; media keys arrive as this with subtype 8.
    const NX_SYSDEFINED: u32 = 14;
    const NX_SUBTYPE_AUX_CONTROL_BUTTONS: i16 = 8;
    const NX_KEYTYPE_SOUND_UP: u32 = 0;
    const NX_KEYTYPE_SOUND_DOWN: u32 = 1;
    const NX_KEYTYPE_MUTE: u32 = 7;
    const KEY_STATE_DOWN: u32 = 0x0A;
    const TAP_DISABLED_BY_TIMEOUT: u32 = 0xFFFF_FFFE;
    const TAP_DISABLED_BY_USER_INPUT: u32 = 0xFFFF_FFFF;

    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        fn CGEventTapCreate(
            tap: u32,
            place: u32,
            options: u32,
            events_of_interest: u64,
            callback: extern "C" fn(CGEventTapProxy, u32, CGEventRef, *mut c_void) -> CGEventRef,
            user_info: *mut c_void,
        ) -> CFMachPortRef;
        fn CGEventTapEnable(tap: CFMachPortRef, enable: bool);
    }

    #[link(name = "CoreFoundation", kind = "framework")]
    extern "C" {
        fn CFMachPortCreateRunLoopSource(
            allocator: *const c_void,
            port: CFMachPortRef,
            order: isize,
        ) -> CFRunLoopSourceRef;
    }

    #[link(name = "ApplicationServices", kind = "framework")]
    extern "C" {
        static kAXTrustedCheckOptionPrompt: CFStringRef;
        fn AXIsProcessTrusted() -> bool;
        fn AXIsProcessTrustedWithOptions(options: *const c_void) -> bool;
    }

    struct TapContext {
        app: AppHandle,
        state: Arc<VolumeKeysState>,
        port: CFMachPortRef,
    }

    /// Ask for Accessibility at most once (marker file); afterwards check
    /// silently so the user is never nagged.
    fn accessibility_granted(app: &AppHandle) -> bool {
        if unsafe { AXIsProcessTrusted() } {
            return true;
        }
        let marker = app
            .path()
            .app_data_dir()
            .ok()
            .map(|dir| dir.join("accessibility-prompted"));
        let Some(marker) = marker else { return false };
        if marker.exists() {
            return false;
        }
        let _ = std::fs::create_dir_all(marker.parent().expect("app data dir"));
        let _ = std::fs::write(&marker, b"1");
        let prompt_key = unsafe { CFString::wrap_under_get_rule(kAXTrustedCheckOptionPrompt) };
        let options = CFDictionary::from_CFType_pairs(&[(
            prompt_key.as_CFType(),
            CFBoolean::true_value().as_CFType(),
        )]);
        unsafe { AXIsProcessTrustedWithOptions(options.as_concrete_TypeRef() as *const c_void) }
    }

    extern "C" fn tap_callback(
        _proxy: CGEventTapProxy,
        event_type: u32,
        event: CGEventRef,
        user_info: *mut c_void,
    ) -> CGEventRef {
        let context = unsafe { &*(user_info as *const TapContext) };

        if event_type == TAP_DISABLED_BY_TIMEOUT || event_type == TAP_DISABLED_BY_USER_INPUT {
            unsafe { CGEventTapEnable(context.port, true) };
            return event;
        }
        if event_type != NX_SYSDEFINED
            || !context.state.focused.load(Ordering::Relaxed)
            || !context.state.player_active.load(Ordering::Relaxed)
        {
            return event;
        }

        // Pass: not a volume key (play/pause etc. must reach the system
        // untouched). Swallow: volume key-up. Emit: volume key-down/repeat.
        let mut swallow = false;
        let mut action: Option<&'static str> = None;
        autoreleasepool(|| {
            let ns_event: *mut Object =
                unsafe { msg_send![class!(NSEvent), eventWithCGEvent: event] };
            if ns_event.is_null() {
                return;
            }
            let subtype: i16 = unsafe { msg_send![ns_event, subtype] };
            if subtype != NX_SUBTYPE_AUX_CONTROL_BUTTONS {
                return;
            }
            let data1: isize = unsafe { msg_send![ns_event, data1] };
            let key_code = ((data1 as u64 & 0xFFFF_0000) >> 16) as u32;
            let volume_action = match key_code {
                NX_KEYTYPE_SOUND_UP => Some("volumeUp"),
                NX_KEYTYPE_SOUND_DOWN => Some("volumeDown"),
                NX_KEYTYPE_MUTE => Some("toggleMute"),
                _ => None,
            };
            let Some(volume_action) = volume_action else {
                return;
            };
            swallow = true;
            let key_state = ((data1 as u64 & 0xFF00) >> 8) as u32;
            if key_state == KEY_STATE_DOWN {
                action = Some(volume_action);
            }
        });

        if let Some(name) = action {
            let _ = context
                .app
                .emit("media-control", json!({ "action": name, "value": null }));
        }
        if swallow {
            ptr::null_mut()
        } else {
            event
        }
    }

    pub fn init(app: AppHandle, state: Arc<VolumeKeysState>) {
        std::thread::spawn(move || {
            if !accessibility_granted(&app) {
                return;
            }

            let context = Box::into_raw(Box::new(TapContext {
                app,
                state,
                port: ptr::null_mut(),
            }));

            unsafe {
                // Session tap, head insert, default (active) options.
                let port = CGEventTapCreate(
                    1,
                    0,
                    0,
                    1_u64 << NX_SYSDEFINED,
                    tap_callback,
                    context as *mut c_void,
                );
                if port.is_null() {
                    drop(Box::from_raw(context));
                    return;
                }
                (*context).port = port;

                let source = CFMachPortCreateRunLoopSource(ptr::null(), port, 0);
                if source.is_null() {
                    return;
                }
                CFRunLoopAddSource(
                    CFRunLoopGetCurrent(),
                    source as *mut _,
                    kCFRunLoopCommonModes,
                );
                CGEventTapEnable(port, true);
                CFRunLoopRun();
            }
        });
    }
}
