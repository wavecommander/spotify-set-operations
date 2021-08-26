import argparse
import string
import spotipy
from spotipy.oauth2 import SpotifyOAuth

scope = "user-library-read user-library-modify playlist-modify-public"
sp = spotipy.Spotify(auth_manager=SpotifyOAuth(scope=scope))


def add_tracks_to_playlist(playlist_id, track_list, ss):
    # Spotify caps adding 100 tracks at a time; workaround by iterating through slices
    tracks_left = len(track_list)
    iterations = 0
    while tracks_left > 0:
        try:
            sp.playlist_add_items(playlist_id, track_list[(ss * iterations):((ss * iterations) + ss)])
        except:
            pass
        tracks_left -= ss
        iterations += 1


def print_enumerated_playlist_tracks(track_iterable):
    [print(f'({count + 1}) \'{item["track"]["name"]}\'\tArtist(s): '
           f'{", ".join([artist["name"] for artist in item["track"]["artists"]])}')
     for count, item in enumerate(track_iterable)]


def print_enumerated_album_tracks(track_iterable):
    [print(f'({count + 1}) \'{item["name"]}\'\tArtist(s): '
           f'{", ".join([artist["name"] for artist in item["artists"]])}')
     for count, item in enumerate(track_iterable)]


def print_playlist_contents(playlist):
    print(f'Contents of Playlist \'{playlist["name"]}\' {playlist["id"]}:')
    tracks = playlist['tracks']['items']
    print_enumerated_playlist_tracks(tracks)
    print()


def print_album_contents(album):
    print(f'Contents of Album \'{album["name"]}\' {album["id"]}:')
    tracks = album['tracks']['items']
    print_enumerated_album_tracks(tracks)
    print()


def print_symbol_mapping(symbol_dict):
    print('Enter a set operation expression to evaluate using the following symbols to represent operations and '
          'the playlists')
    print('Operations: UNION: A | B\tINTERSECTION: A & B\tDIFFERENCE: A - B')
    print('Use parentheses to use the result of an operation in another operation')
    print('Example expression: (A | B) - C')
    print('Example expression: ((A & B) | C) & D')
    print('SYMBOL MAP:')
    [print(f'{symbol}: \'{item["name"]}\' {item["id"]}')
     for symbol, item in symbol_dict.items()]
    print()


def print_playlist_search_results(query, results):
    print(f'Playlist Search Results for {query}:')
    [print(f'\'{item["name"]}\'\tOwner: {item["owner"]["display_name"]}\tId: {item["id"]}') for item in
     results['playlists']['items']]
    print()


def print_album_search_results(query, results):
    print(f'Album Search Results for {query}:')
    [print(
        f'\'{item["name"]}\'\tArtist(s): {", ".join([artist["name"] for artist in item["artists"]])}\tId: {item["id"]}')
     for item in
     results['albums']['items']]
    print()


def print_resulting_playlist(track_set, track_dict):
    print('Resulting Playlist Track Set:')
    [print(f'({count + 1}) \'{track_dict[track]["name"]}\'\tArtist(s): '
           f'{", ".join([artist["name"] for artist in track_dict[track]["artists"]])}') for count, track in
     enumerate(track_set)]
    print()


def get_args():
    parser = argparse.ArgumentParser(description='Take in video parameters')
    parser.add_argument('--playlist-search', type=str, help='playlist search query')
    parser.add_argument('--album-search', type=str, help='album search query')
    parser.add_argument('--playlist-ids', nargs='+', help='list of playlist ids')
    parser.add_argument('--album-ids', nargs='+', help='list of album ids')
    parser.add_argument('-y', action='store_true', help='say yes to creating playlist')
    parser.add_argument('--name', type=str, help='name for created playlist')
    parser.add_argument('--expr', type=str, help='set operation expression')
    parser.add_argument('--slice-size', type=int, default=100, help='size of slices to add tracks to playlist; '
                                                                    'bigger slices are faster, but lose more songs '
                                                                    'if one ID ends up being bad')
    return parser.parse_args()


def get_symbol_dict(playlists, albums):
    symbol_dict = dict()
    for id, playlist in playlists.items():
        symbol_dict[generate_symbol(symbol_dict)] = playlist
    for id, album in albums.items():
        symbol_dict[generate_symbol(symbol_dict)] = album
    return symbol_dict


def generate_symbol(symbol_dict, prefix=None):
    for letter in string.ascii_uppercase:
        symbol = letter
        if prefix:
            symbol = str(prefix) + letter

        if symbol in symbol_dict.keys():
            if letter == 'Z':
                return generate_symbol(symbol_dict, prefix=(symbol[:-1] + '*'))
            else:
                continue
        else:
            return symbol


def add_playlist_contents_to_dicts(playlist_id, playlist_dict, track_dict):
    playlist = sp.playlist(playlist_id)
    playlist['_track_set'] = {track['track']['id'] for track in playlist['tracks']['items']}
    track_dict.update({track['track']['id']: track['track'] for track in playlist['tracks']['items']})
    playlist_dict[playlist['id']] = playlist


def add_album_contents_to_dicts(album_id, album_dict, track_dict):
    album = sp.album(album_id)
    album['_track_set'] = {track['id'] for track in album['tracks']['items']}
    track_dict.update({track['id']: track for track in album['tracks']['items']})
    album_dict[album['id']] = album


def eval_expr(expr, symbol_dict):
    symbol_list = sorted(symbol_dict.items(), reverse=True, key=lambda item: len(item[0]))
    index = 0
    for symbol, item in symbol_list:
        expr = expr.replace(f'{symbol}', f'symbol_dict[symbol_list[{index}][0]]["_track_set"]')
        index += 1
    return eval(expr)


args = get_args()

if args.playlist_search:
    results = sp.search(args.playlist_search, type='playlist', limit=50)
    print_playlist_search_results(args.playlist_search, results)

if args.album_search:
    results = sp.search(args.album_search, type='album', limit=50)
    print_album_search_results(args.album_search, results)

if args.playlist_ids or args.album_ids:
    playlists = dict()
    albums = dict()
    tracks = dict()

    if args.playlist_ids:
        for playlist_id in args.playlist_ids:
            try:
                add_playlist_contents_to_dicts(playlist_id, playlists, tracks)
                print_playlist_contents(playlists[playlist_id])
            except TypeError:
                continue

    if args.album_ids:
        for album_id in args.album_ids:
            try:
                add_album_contents_to_dicts(album_id, albums, tracks)
                print_album_contents(albums[album_id])
            except TypeError:
                continue

    symbol_dict = get_symbol_dict(playlists, albums)
    print_symbol_mapping(symbol_dict)

    if args.expr:
        expr = args.expr
    else:
        expr = input('Expression: ')
    new_track_set = eval_expr(expr, symbol_dict)
    print_resulting_playlist(new_track_set, tracks)

    if not args.y:
        choice = input('Create the resulting playlist? (Y/n): ')
        if choice.lower() == 'n':
            exit(0)

    if args.name:
        playlist_name = args.name
    else:
        playlist_name = input('Name the Playlist: ')

    user_id = sp.me()['id']
    created_playlist_id = sp.user_playlist_create(user_id, playlist_name)['id']

    track_list = list(new_track_set)
    slice_size = min(args.slice_size, 100)
    add_tracks_to_playlist(created_playlist_id, track_list, slice_size)
