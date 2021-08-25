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

Use `python3 cli.py --search 'QUERY'` to search Spotify for playlists; the script will output the IDs in plain text.

Use `python3 cli.py --ids IDS [IDS ...]` to list out the contents of the playlists with those ids and enter a Python set expression to perform set operations on the playlists. Performing a set operation will yield a new playlist on the signed-in Spotify account which you will be prompted to name.

If you want to bypass prompting, use:

`python3 cli.py -y --ids IDS [IDS ...] --name 'NEW_PLAYLIST_NAME' --expr 'PYTHON_SET_EXPRESSION'`


### Examples of Set Expressions
A Python set expression is just code that uses the supplied symbols to represent the playlists.

`(A.union(B)).difference(C)` == the set yielded from (A \\/ B) / C

`((A.intersection(B)).union(C)).intersection(*D)` == ((A /\ B) \/ C) /\ *D

## Proof of Concept

I made a [union of 50 playists that yielded a playlist with 2635 songs](https://open.spotify.com/playlist/46r7MUlc6aMRKDaQSQZGol?si=231d24f8fe0b404a).

The command used to execute the script was:

```shell
python3 cli.py --ids 5Expn82SHXk6SudsRcsOJr 37i9dQZF1DZ06evO0rnvDq 05lfxD2oAcMMiktoR5okE5 2BvJgpKcWBpMHv6gH01k1Z 37i9dQZF1DZ06evO0hk7Li 37i9dQZF1E4q8zXZzvewbH 7Lr63ggfkvuddChfxgp7DF 3JDteoE9R9wG4MkM27JFDv 1oQDkYJEPyuZ0hEg7XY76f 7zTe5mX7foevqApSlbRuS2 1EvlSEBlQFPXkWbBi7LG2V 4kdrAVuPxDdfwOnchhexK1 663Wbm0nWkQq749m2BISDV 6VdwsFsOHP9ntyDyLIe76i 5O3RxjYe6aaf4N57WfvFiZ 37i9dQZF1DZ06evO2u9kys 5mxy2EiizW0OP0hJ370Wsk 1lF1PxQWeFblbJT2f6kpci 7FxP5CM1dMqQaqLgKO4eBt 3OrZ9xixnYhtNZ8jD8mWPW 7JWXz25pRrcHJsDJPwk6J6 0VbepbTmRs98NrfIvZfQhl 3AyFmFDoIeJeEqlR3zC5o7 43Q9NAlPELgWNDRXDfpLLA 1LI3suuiRKcc6lFjDnrTkI 0CKVCAjnzz931r6bAeZtT9 4wGaFCuBBreSmEot6MrG5y 0nITU3LoG0vTHUglcfXmWL 7a3kon7MzrE1NK7yvoaXwW 2VplEFTvRKcUg8xSJzE8Kr 0vz6ketuocZqxwS3NCIVBh 49iCvSSGGHesKPSZ9hpmIV 37i9dQZF1DZ06evO3EVf2Q 4xR0iQ2KJhNbNvRMCvtO2a 1pFWFdKd4caMia0SN4wl2q 17Q98wRVumRIU3LQHeiITu 3oHFqJ7UyOJKjrM9jM1TOJ 2p6G6EENHWmNnmgnIZr5KG 0aOxxY9f2mSkSSCrumEWRD 3AJSjvHKrrAFwZfXaxinUH 5SQZY3jxiO2PbjS9B9fxwF 7c3UuxRetscHHBCjyKooW3 53eZV0JJGJ76dWJDMiqgLC 6oMBAwvwOQtnhGhu3QqpI3 0HtZSEqRMz6L5ZXAWCBgWp 0ZnGLuJUFF6HEjnbxoe2Wg 37i9dQZF1DZ06evO3SRltc 0TmxtvbJwgJQWwkimQtyLb 65Hg5oVG5uZD5Ik2NyIrk1 7sG4fBhqL5kPqwVpdVcqzn
```

The expression used for the union was:

`A.union(B.union(C.union(D.union(E.union(F.union(G.union(H.union(I.union(J.union(K.union(L.union(M.union(N.union(O.union(P.union(Q.union(R.union(S.union(T.union(U.union(V.union(W.union(X.union(Y.union(Z.union(*A.union(*B.union(*C.union(*D.union(*E.union(*F.union(*G.union(*H.union(*I.union(*J.union(*K.union(*L.union(*M.union(*N.union(*O.union(*P.union(*Q.union(*R.union(*S.union(*T.union(*U.union(*V.union(*W))))))))))))))))))))))))))))))))))))))))))))))))`

## Work to Be Done

* ~~Need to expand capability past 26 playlists by including more symbols, or a different mapping strategy altogether (probably the latter)~~ *Symbols for arbitrarily many playlists are now supported*
* Make expression writing shorter and less clunky
    * Sanitize input before running `eval()`
    * Reserve U I D or use \\/ /\\ / , or + - * for set operations
* Add option to include set of tracks from albums 
* Maybe someone can request something
