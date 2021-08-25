import argparse
import string
import spotipy
from spotipy.oauth2 import SpotifyOAuth

scope = "user-library-read user-library-modify playlist-modify-public"
sp = spotipy.Spotify(auth_manager=SpotifyOAuth(scope=scope))


def add_tracks_to_playlist(playlist_id, track_list, ss):
    # Spotify caps adding 100 tracks at a time; workaround by iterating through slices
    try:
        sp.playlist_add_items(playlist_id, track_list[:ss])
    except:
        pass

    tracks_left = len(track_list) - ss
    iterations = 1
    while tracks_left > 0:
        try:
            sp.playlist_add_items(playlist_id, track_list[(ss * iterations):((ss * iterations) + ss)])
        except:
            pass
        tracks_left -= ss
        iterations += 1


def print_enumerated_tracks(track_iterable):
    [print(f'({count + 1}) \'{item["track"]["name"]}\'\tArtist(s): '
           f'{", ".join([artist["name"] for artist in item["track"]["artists"]])}')
     for count, item in enumerate(track_iterable)]


def print_playlist_contents(playlist):
    print(f'Contents of Playlist \'{playlist["name"]}\' {playlist["id"]}:')
    tracks = playlist['tracks']['items']
    print_enumerated_tracks(tracks)
    print()


def print_playlist_symbol_mapping(symbol_dict):
    print('Enter a set operation expression to evaluate using the following symbols to represent operations and '
          'the playlists')
    print('Operations: UNION: A | B\tINTERSECTION: A & B\tDIFFERENCE: A - B')
    print('Use parentheses to use the result of an operation in another operation')
    print('Example expression: (A | B) - C')
    print('Example expression: ((A & B) | C) & D')
    [print(f'{symbol}: \'{playlist["name"]}\' {playlist["id"]}')
     for symbol, playlist in symbol_dict.items()]
    print()


def print_search_results(query, results):
    print(f'Playlist Search Results for {query}:')
    [print(f'\'{item["name"]}\'\tOwner: {item["owner"]["display_name"]}\tId: {item["id"]}') for item in
     results['playlists']['items']]
    print()


def print_resulting_playlist(track_set, track_dict):
    print('Resulting Playlist Track Set:')
    [print(f'({count + 1}) \'{track_dict[track]["name"]}\'\tArtist(s): '
           f'{", ".join([artist["name"] for artist in track_dict[track]["artists"]])}') for count, track in
     enumerate(track_set)]
    print()


def get_args():
    parser = argparse.ArgumentParser(description='Take in video parameters')
    parser.add_argument('--search', type=str, help='search query')
    parser.add_argument('--ids', nargs='+', help='list of playlist ids')
    parser.add_argument('-y', action='store_true', help='say yes to creating playlist')
    parser.add_argument('--name', type=str, help='name for created playlist')
    parser.add_argument('--expr', type=str, help='set operation expression')
    parser.add_argument('--slice-size', type=int, default=100, help='size of slices to add tracks to playlist; '
                                                                    'bigger slices are faster, but lose more songs '
                                                                    'if one ID ends up being bad')
    return parser.parse_args()


def get_playlist_symbol_dict(playlists):
    symbol_dict = dict()
    for id, playlist in playlists.items():
        symbol_dict[generate_symbol(symbol_dict, playlist)] = playlist
    return symbol_dict


def generate_symbol(symbol_dict, playlist, prefix=None):
    for letter in string.ascii_uppercase:
        symbol = letter
        if prefix:
            symbol = str(prefix) + letter

        if symbol in symbol_dict.keys():
            if letter == 'Z':
                return generate_symbol(symbol_dict, playlist, prefix=(symbol[:-1] + '*'))
            else:
                continue
        else:
            return symbol


def add_playlist_contents_to_dicts(playlist_id, playlist_dict, track_dict):
    playlist = sp.playlist(playlist_id)
    playlist['_track_set'] = {track['track']['id'] for track in playlist['tracks']['items']}
    track_dict.update({track['track']['id']: track['track'] for track in playlist['tracks']['items']})
    playlist_dict[playlist['id']] = playlist


def eval_expr(expr, symbol_dict):
    symbol_list = sorted(symbol_dict.items(), reverse=True, key=lambda item: len(item[0]))
    index = 0
    for symbol, playlist in symbol_list:
        expr = expr.replace(f'{symbol}', f'symbol_dict[symbol_list[{index}][0]]["_track_set"]')
        index += 1
    return eval(expr)


args = get_args()

if args.search:
    results = sp.search(args.search, type='playlist', limit=50)
    print_search_results(args.search, results)

if args.ids:
    playlists = dict()
    tracks = dict()
    for playlist_id in args.ids:
        try:
            add_playlist_contents_to_dicts(playlist_id, playlists, tracks)
            print_playlist_contents(playlists[playlist_id])
        except TypeError:
            continue

    symbol_dict = get_playlist_symbol_dict(playlists)
    print_playlist_symbol_mapping(symbol_dict)

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
