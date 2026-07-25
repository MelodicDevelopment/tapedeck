import './bootstrap-styles'

// Tapedeck components (side-effect registration).
import './components/app'
import './components/brand'
import './components/title-bar'
import './components/account-summary'
import './components/sync-chip'
import './components/library-card'
import './components/source-switcher'
import './components/welcome-screen'
import './components/player-screen'
import './components/playback-bar'
import './components/youtube-player'
import './components/mixtape-picker'
import './components/shortcuts-modal'
import './components/confirm-dialog'

import { bootstrap } from './store/actions'

void bootstrap()
