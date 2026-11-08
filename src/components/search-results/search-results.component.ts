import { MelodicComponent } from '@melodicdev/core'
import type { SearchResult } from '../../api/youtube'
import { clearSearch, previewSearchResult, searchResultToTrack, searchVideos } from '../../store/actions'
import { pickerTrack } from '../../store/player'
import { library, searchError, searchQuery, searchResults, searchStatus } from '../../store/state'
import { searchResultsTemplate } from './search-results.template'
import { searchResultsStyles } from './search-results.styles'

/**
 * td-search-results — full-width YouTube search results, shown in place of
 * the library grid on the welcome screen (which overlays the player when
 * one is active). Each card plays on the stage or opens the mixtape picker.
 */
@MelodicComponent({
  selector: 'td-search-results',
  template: searchResultsTemplate,
  styles: searchResultsStyles,
})
export class SearchResultsComponent {
  public elementRef!: HTMLElement

  public searchQuery = searchQuery
  public searchResults = searchResults
  public searchStatus = searchStatus
  public searchError = searchError
  public library = library

  public close(): void {
    clearSearch()
  }

  public retry(): void {
    void searchVideos(this.searchQuery())
  }

  public play(result: SearchResult): void {
    previewSearchResult(result)
  }

  public addToMixtape(result: SearchResult): void {
    pickerTrack.set(searchResultToTrack(result))
  }

  /** Names of the mixtapes that already hold this video, for the card badge. */
  public mixtapesWith(videoId: string): string[] {
    return this.library()
      .mixtapes.filter((mixtape) => mixtape.tracks.some((track) => track.id === videoId))
      .map((mixtape) => mixtape.name)
  }
}
