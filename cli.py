import argparse
import string
import math

import spotipy
from spotipy.oauth2 import SpotifyOAuth

scope = "user-library-read user-library-modify playlist-modify-public playlist-modify-private playlist-read-private"
sp = spotipy.Spotify(auth_manager=SpotifyOAuth(scope=scope))


def get_args():
    parser = argparse.ArgumentParser(
        description='Parameters for interacting with Spotify Playlists and Albums')
    parser.add_argument('--playlist-search', type=str,
                        help='playlist search query')
    parser.add_argument('--album-search', type=str, help='album search query')
    parser.add_argument('--playlist-ids', nargs='+',
                        help='list of playlist ids')
    parser.add_argument('--super-playlist-id', type=str,
                        help='source for dividing playlist')
    parser.add_argument('--public-playlist-id', type=str,
                        help='destination for dividing playlist')
    parser.add_argument('--album-ids', nargs='+', help='list of album ids')
    parser.add_argument('-y', action='store_true',
                        help='say yes to creating playlist')
    parser.add_argument('--name', type=str, help='name for created playlist')
    parser.add_argument('--expr', type=str, help='set operation expression')
    parser.add_argument('--step-size', type=int, default=100, help='size of steps to add tracks to playlist; '
                                                                    'bigger steps are faster, but lose more songs '
                                                                    'if one ID ends up being bad')
    parser.add_argument('--slice-size', type=int, default=30,
                        help='slice size for dividing super playlist')

    return parser.parse_args()


def replace_tracks_on_playlist(playlist_id, track_id_list, ss):
    sp.playlist_replace_items(playlist_id, track_id_list[:ss])
    add_tracks_to_playlist(playlist_id, track_id_list[ss:], ss)


def add_tracks_to_playlist(playlist_id, track_id_list, ss):
    # Spotify caps adding 100 tracks at a time; workaround by iterating through slices
    tracks_left = len(track_id_list)
    iterations = 0
    while tracks_left > 0:
        try:
            sp.playlist_add_items(playlist_id, track_id_list[(
                ss * iterations):((ss * iterations) + ss)])
        except:
            pass
        tracks_left -= ss
        iterations += 1


def print_enumerated_tracks(track_iterable):
    for count, item in enumerate(track_iterable):
        print(
            f'({count + 1}) \'{item["name"]}\'\t{generate_artist_string(item["artists"])}')


def generate_artist_string(artists):
    return f'Artist(s): {", ".join([artist["name"] for artist in artists])}'


def print_playlist_contents(playlist, track_dict):
    print(f'Contents of Playlist \'{playlist["name"]}\' {playlist["id"]}:')
    tracks = [track_dict[track_id] for track_id in playlist['_track_set']]
    print_enumerated_tracks(tracks)
    print()


def print_album_contents(album):
    print(f'Contents of Album \'{album["name"]}\' {album["id"]}:')
    tracks = album['tracks']['items']
    print_enumerated_tracks(tracks)
    print()


def print_symbol_mapping(symbol_dict):
    print('Enter a set operation expression to evaluate using the following symbols to represent operations and '
          'the playlists')
    print('Operations: UNION: A | B\tINTERSECTION: A & B\tDIFFERENCE: A - B')
    print('Use parentheses to use the result of an operation in another operation')
    print('Example expression: (A | B) - C')
    print('Example expression: ((A & B) | C) & D')
    print('SYMBOL MAP:')
    for symbol, item in symbol_dict.items():
        print(f'{symbol}: \'{item["name"]}\' {item["id"]}')
    print()


def print_playlist_search_results(query, results):
    print(f'Playlist Search Results for {query}:')
    for item in results['playlists']['items']:
        print(
            f'\'{item["name"]}\'\tOwner: {item["owner"]["display_name"]}\tId: {item["id"]}')
    print()


def print_album_search_results(query, results):
    print(f'Album Search Results for {query}:')
    for item in results['albums']['items']:
        print(
            f'\'{item["name"]}\'\t{generate_artist_string(item["artists"])}\tId: {item["id"]}')
    print()


def print_resulting_playlist(track_set, track_dict):
    print('Resulting Playlist Track Set:')
    print_enumerated_tracks([track_dict[track] for track in track_set])
    print()


def get_symbol_dict(playlists, albums):
    symbol_dict = dict()
    index = 0

    for id, playlist in playlists.items():
        symbol_dict[get_symbol(index)] = playlist
        index += 1
    for id, album in albums.items():
        symbol_dict[get_symbol(index)] = album
        index += 1
    return symbol_dict


def get_symbol(index):
    return f'{"*" * (index // 26)}{string.ascii_uppercase[index % 26]}'


def add_paginated_playlist_contents_to_dicts(playlist_id, playlist_dict, track_dict):
    track_set = set()
    playlist = sp.playlist(playlist_id)
    playlist_dict[playlist['id']] = playlist
    playlist['_track_set'] = track_set

    add_playlist_contents_to_dicts(playlist['tracks'], track_dict, track_set)

    # Handle pagination
    if playlist['tracks'].get('next'):
        next_tracks = sp.next(playlist['tracks'])
        add_playlist_contents_to_dicts(next_tracks, track_dict, track_set)
        while next_tracks.get('next'):
            next_tracks = sp.next(next_tracks)
            add_playlist_contents_to_dicts(next_tracks, track_dict, track_set)


def add_playlist_contents_to_dicts(playlist, track_dict, track_set):
    track_set.update({track['track']['id'] for track in playlist['items']})
    track_dict.update({track['track']['id']: track['track']
                      for track in playlist['items']})


def add_album_contents_to_dicts(album_id, album_dict, track_dict):
    album = sp.album(album_id)
    album['_track_set'] = {track['id'] for track in album['tracks']['items']}
    track_dict.update(
        {track['id']: track for track in album['tracks']['items']})
    album_dict[album['id']] = album


def eval_expr(expr, symbol_dict):
    symbol_list = sorted(symbol_dict.items(), reverse=True,
                         key=lambda item: len(item[0]))

    allowed_chars = [c for c in string.ascii_uppercase]
    allowed_chars.extend(['(', ')', '*', '&', '|', '-', '^'])

    sanitized_expr = ''.join(c for c in expr if c in allowed_chars)

    index = 0
    for symbol, item in symbol_list:
        sanitized_expr = sanitized_expr.replace(
            f'{symbol}', f'symbol_dict[symbol_list[{index}][0]]["_track_set"]')
        index += 1
    return eval(sanitized_expr, {'__builtins__': None}, {'symbol_dict': symbol_dict, 'symbol_list': symbol_list})


def get_playlist_track_slice(playlist, step, step_size):
    tracks = playlist['tracks']['items']
    start = (step * step_size)
    end = (start + step_size)
    return tracks[start:end]


if __name__ == "__main__":
    args = get_args()

    if args.playlist_search:
        results = sp.search(args.playlist_search, type='playlist', limit=50)
        print_playlist_search_results(args.playlist_search, results)

    if args.album_search:
        results = sp.search(args.album_search, type='album', limit=50)
        print_album_search_results(args.album_search, results)

    if args.super_playlist_id:
        super_playlist = sp.playlist(args.super_playlist_id)

        super_tracks = super_playlist['tracks']['items']
        if super_playlist['tracks'].get('next'):
            next_tracks = sp.next(super_playlist['tracks'])
            super_tracks.extend(next_tracks)
            while next_tracks.get('next'):
                next_tracks = sp.next(next_tracks)
                super_tracks.extend(next_tracks)

        private_track_lists = [get_playlist_track_slice(super_playlist, i, args.slice_size) for i in range(
            math.ceil(len(super_tracks)/args.slice_size))]

        user_id = sp.me()['id']
        for count, track_list in enumerate(private_track_lists):
            track_id_list = [track['track']['id'] for track in track_list]
            name = f'{super_playlist["name"].replace(" ", "-")}-sub-{count + 1}'
            created_playlist_id = sp.user_playlist_create(
                user_id, name, public=False)['id']
            print(f'Created sub playlist\tName: {name}\tId:{created_playlist_id}')
            add_tracks_to_playlist(created_playlist_id, track_id_list, 100)

    if args.playlist_ids or args.album_ids:
        playlists = dict()
        albums = dict()
        tracks = dict()

        if args.playlist_ids:
            for playlist_id in args.playlist_ids:
                try:
                    add_paginated_playlist_contents_to_dicts(
                        playlist_id, playlists, tracks)
                    print_playlist_contents(playlists[playlist_id], tracks)
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
        new_track_id_set = eval_expr(expr, symbol_dict)
        print_resulting_playlist(new_track_id_set, tracks)

        track_id_list = list(new_track_id_set)
        step_size = min(args.step_size, 100)

        if args.public_playlist_id:
            playlist_id = args.public_playlist_id
            replace_tracks_on_playlist(playlist_id, track_id_list, step_size)
        else:
            if not args.y:
                choice = input('Create the resulting playlist? (Y/n): ')
                if choice.lower() == 'n' or choice.lower() == 'no':
                    exit(0)

            if args.name:
                playlist_name = args.name
            else:
                playlist_name = input('Name the Playlist: ')

            user_id = sp.me()['id']
            playlist_id = sp.user_playlist_create(user_id, playlist_name)['id']
            add_tracks_to_playlist(playlist_id, track_id_list, step_size)
