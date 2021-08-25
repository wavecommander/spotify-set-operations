# spotify-set-operations

Little CLI tool to apply set operations to Spotify playlists and create the resulting playlists

### WARNING
This script runs unsanitized strings as Python code with eval(); I am not responsible if you rm your only copy of your favorite family recipe.

## Usage

Use `python3 cli.py --search 'QUERY'` to search Spotify for playlists; the script will output the IDs in plaintext.

Use `python3 cli.py --ids IDS [IDS ...]` to list out the contents of the playlists with those ids and enter a Python set expression to perform set operations on the playlists. Performing a set operation will yield a new playlist on the signed-in Spotify account which you will be prompted to name.

You can also use `python3 cli.py --ids IDS [IDS ...] --name 'NEW_PLAYLIST_NAME' --expr 'PYTHON_SET_EXPRESSION'` to bypass the prompting.

## Proof of Concept

I made a union of 26 playlists to yield [this MEGA playlist of 1464 songs](https://open.spotify.com/playlist/7Jcre7K8C9PJ5W6iQHHVpF?si=7ccaf435c7884fd9)
The expression used for that union was `A.union(B.union(C.union(D.union(E.union(F.union(G.union(H.union(I.union(J.union(K.union(L.union(M.union(N.union(O.union(P.union(Q.union(R.union(S.union(T.union(U.union(V.union(W.union(X.union(Y.union(Z)))))))))))))))))))))))))`

Need to expand capability past 26 playlists by including more symbols, or a different mapping strategy altogether.
