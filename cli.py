import argparse
import json
import string
import spotipy
from spotipy.oauth2 import SpotifyOAuth


def print_playlist_contents(playlist):
        print(f'Contents of Playlist \'{playlist["name"]}\' {id}:')
        tracks = playlist['tracks']['items']
        [print(f'({count+1}) \'{item["track"]["name"]}\'\tArtist(s): {", ".join([artist["name"] for artist in item["track"]["artists"]])}') for count, item in enumerate(tracks)]
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
                return generate_symbol(symbol_dict, playlist, prefix=(symbol[:-1] + 'A'))
            else:
                continue
        elif letter == 'D' or letter == 'I' or letter == 'U':
                continue
        else:
            return symbol


def evaluate_expr(expr, symbol_dict):
    pass

parser = argparse.ArgumentParser(description='Take in video parameters')
parser.add_argument('--search', type=str, help='search query')
parser.add_argument('--id', nargs='+', help='playlist id(s)')
parser.add_argument('--expr', type=str, help='set operation expression')

args = parser.parse_args()

scope = "user-library-read"
sp = spotipy.Spotify(auth_manager=SpotifyOAuth(scope=scope))


if args.search:
    results = sp.search(args.search, type='playlist')
    print(f'Playlist Search Results for {args.search}:')
    [print(f'Name: {item["name"]}\tOwner: {item["owner"]["display_name"]}\tId: {item["id"]}') for item in results['playlists']['items']]
    print()


if args.id:
    ids = args.id[0].split()
    playlists = dict()
    tracks = dict()
    for id in ids:
        playlist = sp.playlist(id)
        playlist['_track_set'] = {track['track']['id'] for track in playlist['tracks']['items']}
        tracks.update({track['track']['id']: track['track'] for track in playlist['tracks']['items']})
        playlists[playlist['id']] = playlist
        print_playlist_contents(playlist)

    symbol_dict = get_playlist_symbol_dict(playlists)
    print('Enter a set operation expression to evaluate using the following symbols to represent operations and the playlists')
    print('Operations: U, \/ - UNION\tI, /\ - INTERSECTION\tD, / - DIFFERENCE')
    print('Use parentheses to use the result of an operation in another operation')
    print('Example expression: \'(A U B) D C\' - resulting set of set A union set B difference set C')
    print('Example expression: \'(A \/ B) / C\' - resulting set of set A union set B difference set C')
    for symbol, playlist in symbol_dict.items():
        print(f'{symbol}: \'{playlist["name"]}\' {playlist["id"]}')
    # expr = input('Expression: ')
    expr = '(A \/ B) / C'
    if args.expr:
        expr = args.expr
    
    evaluate_expr(expr, symbol_dict)
