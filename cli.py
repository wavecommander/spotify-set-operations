import argparse
import string
import spotipy
from spotipy.oauth2 import SpotifyOAuth


def print_playlist_contents(playlist):
    print(f'Contents of Playlist \'{playlist["name"]}\' {id}:')
    tracks = playlist['tracks']['items']
    [print(f'({count + 1}) \'{item["track"]["name"]}\'\tArtist(s): '
           f'{", ".join([artist["name"] for artist in item["track"]["artists"]])}')
     for count, item in enumerate(tracks)]
    print()


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


parser = argparse.ArgumentParser(description='Take in video parameters')
parser.add_argument('--search', type=str, help='search query')
parser.add_argument('--ids', nargs='+', help='list of playlist ids')
parser.add_argument('-y', action='store_true', help='say yes to creating playlist')
parser.add_argument('--name', type=str, help='name for created playlist')
parser.add_argument('--expr', type=str, help='set operation expression')
parser.add_argument('--slice-size', type=int, default=100, help='size of slices to add tracks to playlist; '
                                                                'bigger slices are faster, but lose more songs '
                                                                'if one ID ends up being bad')

args = parser.parse_args()

scope = "user-library-read user-library-modify playlist-modify-public"
sp = spotipy.Spotify(auth_manager=SpotifyOAuth(scope=scope))

if args.search:
    results = sp.search(args.search, type='playlist', limit=50)
    print(f'Playlist Search Results for {args.search}:')
    [print(f'\'{item["name"]}\'\tOwner: {item["owner"]["display_name"]}\tId: {item["id"]}') for item in
     results['playlists']['items']]
    print()

if args.ids:
    playlists = dict()
    tracks = dict()
    print(f'ARG IDS: {args.ids}')
    for id in args.ids:
        playlist = sp.playlist(id)
        try:
            playlist['_track_set'] = {track['track']['id'] for track in playlist['tracks']['items']}
            tracks.update({track['track']['id']: track['track'] for track in playlist['tracks']['items']})
            playlists[playlist['id']] = playlist
            print_playlist_contents(playlist)
        except TypeError:
            continue

    symbol_dict = get_playlist_symbol_dict(playlists)
    print('Enter a set operation expression to evaluate using the following symbols to represent operations and '
          'the playlists')
    print('Operations: A.union(B)\tA.intersection(B)\tA.difference(B)')
    print('Use parentheses to use the result of an operation in another operation')
    print('Example expression: \'((A.union(B)).difference(C)\'')
    print('Example expression: \'(((A.intersection(B)).union(C)).intersection(D)\'')
    for symbol, playlist in symbol_dict.items():
        print(f'{symbol}: \'{playlist["name"]}\' {playlist["id"]}')
    print()

    if args.expr:
        expr = args.expr
    else:
        expr = input('Expression: ')

    symbol_list = sorted(symbol_dict.items(), reverse=True, key=lambda item: len(item[0]))
    index = 0
    for symbol, playlist in symbol_list:
        print(symbol)
        expr = expr.replace(f'{symbol}', f'symbol_dict[symbol_list[{index}][0]]["_track_set"]')
        index += 1

    new_track_set = eval(expr)
    print('Resulting Playlist Track Set:')
    [print(f'({count + 1}) \'{tracks[track]["name"]}\'\tArtist(s): '
           f'{", ".join([artist["name"] for artist in tracks[track]["artists"]])}') for count, track in
     enumerate(new_track_set)]
    print()

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
    ss = args.slice_size

    # Spotify caps adding 100 tracks at a time; workaround by iterating through slices
    try:
        sp.playlist_add_items(created_playlist_id, track_list[:ss])
    except:
        pass

    tracks_left = len(track_list) - ss
    iterations = 1
    while tracks_left > 0:
        try:
            sp.playlist_add_items(created_playlist_id, track_list[(ss * iterations):((ss * iterations) + ss)])
        except:
            pass
        tracks_left -= ss
        iterations += 1
