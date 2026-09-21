import 'dart:convert';
import 'dart:math';
import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

class AuthService extends ChangeNotifier {
  String? _spotifyAccessToken;
  String? _ytmusicAccessToken;

  String spotifyClientId = '88962541e5e34523861008cd3c75a285';
  String ytmusicClientId = 'ytmusic-client-id.apps.googleusercontent.com';

  static const String redirectUri = 'http://127.0.0.1:8888/callback';

  bool get isSpotifyConnected => _spotifyAccessToken != null;
  bool get isYTMusicConnected => _ytmusicAccessToken != null;

  String? get spotifyAccessToken => _spotifyAccessToken;
  String? get ytmusicAccessToken => _ytmusicAccessToken;

  AuthService() {
    _loadStoredTokens();
  }

  Future<void> _loadStoredTokens() async {
    final prefs = await SharedPreferences.getInstance();
    _spotifyAccessToken = prefs.getString('spotify_access_token');
    _ytmusicAccessToken = prefs.getString('ytmusic_access_token');
    notifyListeners();
  }

  /// Helper to generate PKCE Code Verifier
  String _generateCodeVerifier() {
    final random = Random.secure();
    final values = List<int>.generate(64, (i) => random.nextInt(256));
    return base64UrlEncode(values).replaceAll('=', '');
  }

  /// Helper to generate PKCE Code Challenge
  String _generateCodeChallenge(String verifier) {
    final bytes = utf8.encode(verifier);
    final digest = sha256.convert(bytes);
    return base64UrlEncode(digest.bytes).replaceAll('=', '');
  }

  /// Initiates Spotify PKCE OAuth flow by launching the auth URL
  Future<void> authenticateSpotify({String? customClientId}) async {
    if (customClientId != null && customClientId.isNotEmpty) {
      spotifyClientId = customClientId;
    }
    final verifier = _generateCodeVerifier();
    final challenge = _generateCodeChallenge(verifier);

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('spotify_code_verifier', verifier);

    final scopes = Uri.encodeComponent(
      'user-library-read user-library-modify playlist-modify-public playlist-modify-private playlist-read-private',
    );

    final authUrl = Uri.parse(
      'https://accounts.spotify.com/authorize?'
      'client_id=$spotifyClientId&'
      'response_type=code&'
      'redirect_uri=${Uri.encodeComponent(redirectUri)}&'
      'scope=$scopes&'
      'code_challenge_method=S256&'
      'code_challenge=$challenge',
    );

    if (await canLaunchUrl(authUrl)) {
      await launchUrl(authUrl, mode: LaunchMode.externalApplication);
    }
  }

  /// Set Spotify Access Token manually or via OAuth redirect callback code
  Future<void> setSpotifyAccessToken(String token, {String? refreshToken}) async {
    _spotifyAccessToken = token;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('spotify_access_token', token);
    if (refreshToken != null) {
      await prefs.setString('spotify_refresh_token', refreshToken);
    }
    notifyListeners();
  }

  /// Initiates YouTube Music / Google OAuth flow
  Future<void> authenticateYTMusic({String? customClientId}) async {
    if (customClientId != null && customClientId.isNotEmpty) {
      ytmusicClientId = customClientId;
    }
    final verifier = _generateCodeVerifier();
    final challenge = _generateCodeChallenge(verifier);

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('ytmusic_code_verifier', verifier);

    final scopes = Uri.encodeComponent(
      'https://www.googleapis.com/auth/youtube.force-ssl https://www.googleapis.com/auth/youtube',
    );

    final authUrl = Uri.parse(
      'https://accounts.google.com/o/oauth2/v2/auth?'
      'client_id=$ytmusicClientId&'
      'response_type=code&'
      'redirect_uri=${Uri.encodeComponent(redirectUri)}&'
      'scope=$scopes&'
      'code_challenge_method=S256&'
      'code_challenge=$challenge',
    );

    if (await canLaunchUrl(authUrl)) {
      await launchUrl(authUrl, mode: LaunchMode.externalApplication);
    }
  }

  /// Set YouTube Music Access Token
  Future<void> setYTMusicAccessToken(String token, {String? refreshToken}) async {
    _ytmusicAccessToken = token;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('ytmusic_access_token', token);
    if (refreshToken != null) {
      await prefs.setString('ytmusic_refresh_token', refreshToken);
    }
    notifyListeners();
  }

  Future<void> disconnectSpotify() async {
    _spotifyAccessToken = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('spotify_access_token');
    await prefs.remove('spotify_refresh_token');
    notifyListeners();
  }

  Future<void> disconnectYTMusic() async {
    _ytmusicAccessToken = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('ytmusic_access_token');
    await prefs.remove('ytmusic_refresh_token');
    notifyListeners();
  }
}
