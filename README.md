# spotify-set-operations

Little CLI tool to apply set operations to Spotify playlists and create the resulting playlists

## WARNING
This script runs unsanitized strings as Python code with eval(); I am not responsible if you rm your only copy of your favorite family recipe.

## Usage

Use `python3 cli.py --search 'QUERY'` to search Spotify for playlists; the script will output the IDs in plaintext.

Use `python3 cli.py --ids IDS [IDS ...]` to list out the contents of the playlists with those ids and enter a Python set expression to perform set operations on the playlists. Performing a set operation will yield a new playlist on the signed-in Spotify account which you will be prompted to name.

You can also use `python3 cli.py -y --ids IDS [IDS ...] --name 'NEW_PLAYLIST_NAME' --expr 'PYTHON_SET_EXPRESSION'` to bypass the prompting.

## Proof of Concept

I made a union of 26 playlists to yield [this MEGA playlist of 1464 songs](https://open.spotify.com/playlist/7Jcre7K8C9PJ5W6iQHHVpF?si=7ccaf435c7884fd9).

The command used to execute the script was:

`python cli.py --ids 5Expn82SHXk6SudsRcsOJr 05lfxD2oAcMMiktoR5okE5 2BvJgpKcWBpMHv6gH01k1Z 37i9dQZF1DZ06evO0hk7Li 37i9dQZF1E4q8zXZzvewbH 7Lr63ggfkvuddChfxgp7DF 3JDteoE9R9wG4MkM27JFDv 1oQDkYJEPyuZ0hEg7XY76f 7zTe5mX7foevqApSlbRuS2 1EvlSEBlQFPXkWbBi7LG2V 4kdrAVuPxDdfwOnchhexK1 663Wbm0nWkQq749m2BISDV 6VdwsFsOHP9ntyDyLIe76i 5O3RxjYe6aaf4N57WfvFiZ 37i9dQZF1DZ06evO2u9kys 5mxy2EiizW0OP0hJ370Wsk 1lF1PxQWeFblbJT2f6kpci 7FxP5CM1dMqQaqLgKO4eBt 3OrZ9xixnYhtNZ8jD8mWPW 7JWXz25pRrcHJsDJPwk6J6 0VbepbTmRs98NrfIvZfQhl 3AyFmFDoIeJeEqlR3zC5o7 43Q9NAlPELgWNDRXDfpLLA 1LI3suuiRKcc6lFjDnrTkI 0CKVCAjnzz931r6bAeZtT9 7a3kon7MzrE1NK7yvoaXwW`

The expression used for the massive union was:

`A.union(B.union(C.union(D.union(E.union(F.union(G.union(H.union(I.union(J.union(K.union(L.union(M.union(N.union(O.union(P.union(Q.union(R.union(S.union(T.union(U.union(V.union(W.union(X.union(Y.union(Z)))))))))))))))))))))))))`


## Work to Be Done

Need to expand capability past 26 playlists by including more symbols, or a different mapping strategy altogether (probably the latter).
