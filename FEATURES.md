# Astralia Deck Stats Features

Inventory of features available in the project as of November 10, 2026 (commit `aef73dc`). This document describes the current interface and behavior; the Git history also includes features that were later changed or removed.

## Card catalog and deck builder

- Card catalog loaded from `client/public/data/cards.csv`, with card images and support for both faces of flippable cards.
- Five selectable factions: Chronicle of Heroes, Chronicle of Twilight, Chronicle of Progress, Chronicle of Surveillance, and Chronicle of Catastrophe. The selected faction determines which cards are available for the deck.
- Create, edit, and delete decks on the **My Decks** page. Decks are stored in the browser's `localStorage` and sorted by most recent edit; deletion requires confirmation.
- Set a deck name and custom background image, and remove the background image later.
- Add a description (up to 5000 characters) to any deck, including private and browser-local decks. Descriptions are included in backups and public deck imports, and can also be edited during publication.
- Separate **Protagonist**, **Persona Cards**, and **Deck Cards** sections, with counters and limits of 1, 5, and 45 cards respectively. All printings share the same copy limit for a card.
- The **Sideboard** appears below Main Deck for every deck. Its cards are saved with browser-local and cloud decks.
- Add and remove cards with `+` and `-` controls; reorder Persona cards and main deck cards by dragging them.
- Search by card name or ID in the deck builder. The **Card Library** also has filters for set, rarity, cost, type, subtype, keyword, ATK, and HP.
- The stacked-card icon in the builder marks cards with multiple printings. Click the card to choose artwork, including Kickstarter promos where available. The choice applies to every copy of the card and is saved with the deck for use in matches.
- The Card Library includes the playable Kickstarter, Legacy Art, Stained Glass, and Seasonal Promo printings.
- The builder and Card Library list APX A and B separately. The library can filter by APX. Each version has its own deck quantity, and both count toward the same copy limit.
- Preview cards and open a detail view showing the image, cost, type, subtype, description, and keywords.
- Main deck statistics: card count, cost curve, and counts by type and subtype.
- Opening hand simulator: shuffle the actual card quantities in the deck, draw five cards, select cards for one mulligan, and generate another hand. The simulation resets when the deck changes.

## Import and sharing

- Share a deck through an import link compatible with the official site. The link is copied to the clipboard automatically when the browser allows it.
- Official export links use each card's base artwork. APX A and B keep their own artwork codes.
- Import from official links, local links with a `deck` parameter, and older compact codes from this project. Opening a local link on **My Decks** opens the import dialog directly.
- Imported decks are saved among local decks. Custom background images are not included in the shared format.
- Signed-in players can publish and unpublish their cloud decks from **My decks**. Saved edits to a published deck are public; imports remain independent private copies.
- **Public decks** provides name search, chronicle filters, pagination, card previews, and import to an account or guest browser storage. Custom backgrounds are not copied.
- Author names open public player profiles with their bio, avatar, favorite chronicle, website, and published decks. Profiles become public when their owner publishes a deck or comments on a public deck; email and authentication data stay private.
- Public deck previews display card images, the creator's description, and comments with threaded replies. Signed-in creators and other players can participate; comments show names, avatars, profile links, and a creator badge. Discussions are hidden when a deck is withdrawn and retained for republication.

## Lobby and online matches

- **Multiplayer** in the sidebar opens a searchable public room list with host and room names, occupancy, spectators, and filters for open seats and ongoing matches; it refreshes every five seconds.
- Create public rooms discoverable by all visitors, or private rooms accessible only through their six-character code. Existing rooms remain private. Public rooms provide separate player and spectator actions; full or started rooms cannot accept a new player.
- Only the host starts a match, after both players are connected and have selected a saved local or account deck. Matches do not start automatically when a guest joins.
- Players choose their Fragment artwork in the lobby. The browser remembers the choice for new rooms, and the chosen artwork is shown on each player's Fragment rail in the match.
- Host a room or join as the second player using a six-character code. The player's name is remembered in the browser.
- Each player selects a locally saved deck; the host can start the match once both players have selected one.
- Join as a spectator before or during a match, with a limit of 20 spectators. Spectators see the table and both players' complete hands, with both hand panels expanded by default. Deck contents remain private, and spectators cannot change the match.
- Resume a player session after a disconnection or page reload using a token stored in the browser. Rooms are kept in server memory; rooms with no connected players expire after 30 minutes of inactivity, and a server restart closes them.
- At match start, each main deck is shuffled, each player receives five cards, and the Protagonist and Persona cards are placed in their respective zones.
- Track the active player and turn number, agree on who starts when needed, and use the **End turn** button when it is your turn. The table highlights the current turn.
- A shared **Activity log**, opened or closed with **Log**, records turns, card movements, combat, counters, Fragments, and deck actions. Players and spectators see the same history, including after reconnecting or joining late. Hidden card identities stay private; the latest 1,000 actions are retained.

## Game table

- Shared table with hand, deck, Protagonist, five Battle slots, Persona, Graveyard, Oblivion, and a central area for played Action cards. The layout adapts to different screen sizes.
- Open zones and Battle or Protagonist slots to view their cards in a rail; expand or collapse either player's hand. Cards beneath the main card in a slot appear in a horizontal carousel.
- Move your own cards by dragging or using a context menu, including to the top or bottom of the deck. Stack cards in Battle and Protagonist slots, swap a card with the main card, attach cards to other cards, give the opponent control of a card, and take back control.
- Manage your own deck: shuffle, draw one or more cards, discard or send one or more cards to Oblivion, look at the top cards, and search the deck. While viewing cards, move a card to the top or bottom of the deck.
- Request actions on the opponent's deck. The opponent can accept or decline, and the requester can cancel a pending request.
- Flipped and face-down cards are synchronized between players. A card in hand can be revealed or hidden voluntarily; the opponent sees only revealed cards and the total number of cards in hand, while spectators see both complete hands.
- Inspect cards during a match. Cards on the table automatically show printed ATK and HP when available; these values can also be set, adjusted, or removed manually.
- Use **Frazzle** markers, preset number counters, status markers, and custom counters with a name and optional emoji. Add, remove, spend, and recover up to ten Fragments individually or all at once.
- Declare an attacker or blocker by choosing an opposing card; arrows on the table show the pairings. Temporary target arrows and a command to clear a target are also available.
- Open card and deck action menus with a right click. Customizable single-key shortcuts work while pointing at a card, deck, Fragment, or counter. Shortcuts can be reset to their defaults.

## Settings and help

- Open **Settings** from the home page or a match to adjust appearance and keyboard shortcuts. Preferences are stored in the browser.
- Adjust the match interface size from 75% to 150%.
- Choose the End turn button's position along the center line of the table; adjust the turn light's intensity, size, shape, and faction or custom color.
- Choose an optional animated cursor in the appearance settings. Custom cursors are disabled on devices without a fine pointer and when reduced motion is requested.
- Open **Getting started** for a quick introduction to the Card library, My decks, Public decks, and Multiplayer. Use **Send feedback** on that page to report a bug or suggest an improvement.

## Project scope

The online table is a manual play space: players follow the game rules and move cards and markers themselves. Decks and preferences are local to the browser; rooms and active matches are stored in server memory.
