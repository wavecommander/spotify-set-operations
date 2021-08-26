# spotify-set-operations

Little CLI tool to apply set operations to Spotify playlists and create the resulting playlists

## WARNING
This script runs unsanitized strings as Python code with `eval()`; I am not responsible if you rm your only copy of your favorite family recipe.

## Usage

You must make some environment variables available to the script:

```shell
export SPOTIPY_CLIENT_ID='SPOTIPY_CLIENT_ID'
export SPOTIPY_CLIENT_SECRET='SPOTIPY_CLIENT_SECRET'
export SPOTIPY_REDIRECT_URI='SPOTIPY_REDIRECT_URI'
```
In order to obtain these credentials you must create and register a Spotify app [here](https://developer.spotify.com/dashboard/applications).

Use `python3 cli.py --playlist-search 'QUERY'` to search Spotify for playlists; the script will output the IDs in plain text.

Use `python3 cli.py --album-search 'QUERY'` to search Spotify for albums; the script will output the IDs in plain text.

Use `python3 cli.py --playlist-ids IDS [IDS ...] AND/OR --album-ids IDS [IDS ...]` to list out the contents of the playlists with those ids and enter a Python set expression to perform set operations on the playlists. Performing a set operation will yield a new playlist on the signed-in Spotify account which you will be prompted to name.

If you want to bypass prompting, use:

`python3 cli.py -y --playlist-ids IDS [IDS ...] --album-ids IDS [IDS ...] --name 'NEW_PLAYLIST_NAME' --expr 'PYTHON_SET_EXPRESSION'`


### Examples of Set Expressions
A Python set expression is just code that uses the supplied symbols to represent the playlists as sets.

`|` is union, `&` is intersection, `-` is difference, and `^` is symmetric difference.

`(A | B) - C` == the set yielded from (A \\/ B) / C

`((A & B) | C) & *D` == ((A /\ B) \/ C) /\ *D

## Proof of Concept

I made [a union of 51 playists that yielded a playlist with 11000 songs (the maximum)](https://open.spotify.com/playlist/6sRQJW3gwK0DwfSAhEzQHl?si=ab671f46bb064786).

The command used to execute the script was:

```shell
python3 cli.py --playlist-ids 1qVaRy6kQoZkkyIHFPfJsW 2REb6YDnp5qH9IIkMza580 5NenbL246rNAKGH9lXiixc 4iMdrHrW1OmyZLV8BPUEbu 3lfT5ZcbarQ8ZI71RDWy5u 3uXtYhHfORolbG302MPW8M 1lZDftlmPVvMpRLzGLZwjP 5tYo5VbfokbyldiJuwYVvg 4SK3HGc8kZDq72obfdGFNb 37i9dQZF1DX7V3MgTiyyqp 53bg3syDf3kQmPxYN2W07m 4c6hjPFAuIYorSnqZIANaP 2veco7i495KgJ0kWLpQTRr 0iF6oZYeZXeI86XJ5u2BbR 0vy7nuJMzzUAMV0XOYB9T7 75sFI9pXWjTCVI8ezrFBkI 3NeDoPKICiFlaoecUA1hvw 1WdpcUueUepQhAqwCOWVW4 6mFqEOuVk7rbCLXEHjquUG 7CvBRkwlMSrpxzyxKKFIbY 5PjTu6gIFm2SRhRwrZgvhs 3tGy4KkuOX05teizHXxyiL 7tsQViZ1CZtb0CNAmCAwhS 0kx3IPyILYiw5ggWyTyznv 5tWnGRENJmbsav0rNGQN2J 7lGJYWJmG29HjJpHnn3NnP 7udDg9WQJQLQilueQvrOMS 5K4WAJZFfNZrZMf5JgBsAa 5lYx6BZaKpVGM1TYb0d9Jq 69zTxDN28ee5R6tztahjW5 7dW5AGPPBJoceQRejPy84T 36qzJnK6OoUtoRvjgmiNfu 7sZe1uegJ3AQHWsumBDZt3 3FPvvx5mfjD8etnqs7DrMU 77wFrWOVpo597nRxz673TL 6PAZXARur6K049GCwlng5c 67s7BnOu9czd8ingJrkYW1 0O4c3oOYHC970Ln8AzVLxE 3Dai7NQxzUOlaLkfZrQt6v 0anRZkVCcd2rvFBlONSGQH 3t0P8jk5cZ6pUdbQyGqxq1 3mdcJmw8olQPlkHaG6BhUw 4zMvVnx8oKt0sJtXP09Y3F 5vTMFOquz2z7PE3FIjXrAf 4SvyIPxYuBNx3Grv3cRpMM 2tGp2L72CmagpK2tYsMq62 2TiMXwLqtqUilyj4BpWX6U 4sNUf3Z3fFwqp06g4zeetE 75EoA9fDFF259csoelzK3a 6PraGaEghR4e5O23GvtGR3 0u6DT2C8tUaqCxgAbHVWvw
```

The expression used for the union was:

`A | B | C | D | E | F | G | H | I | J | K | L | M | N | O | P | Q | R | S | T | U | V | W | X | Y | Z | *A | *B | *C | *D | *E | *F | *G | *H | *I | *J | *K | *L | *M | *N | *O | *P | *Q | *R | *S | *T | *U | *V | *W | *X | *Y`

To be clear, making MEGA playlists is not the only thing possible with this script; you can subtract the tracks from individual albums from playlists and do further set operations on the result as well.

## Work to Be Done

* ~~Need to expand capability past 26 playlists by including more symbols, or a different mapping strategy altogether (probably the latter)~~ *Symbols for arbitrarily many playlists are now supported; have tested up to 150*
* ~~Make expression writing shorter and less clunky~~ *Silly me realized Python set operations already support | for union, & for intersection, - for difference*
* ~~Add option to include set of tracks from albums~~ [Done](https://github.com/wavecommander/spotify-set-operations/pull/1)
* ~~Add support for pagination so more than the first 100 songs are used~~
* Sanitize input and lock down `eval()`
* Stop duplicates of tracks being added by hashing certain features
* Maybe someone can request something
