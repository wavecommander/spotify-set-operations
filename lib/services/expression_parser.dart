import '../models/track.dart';
import 'set_engine.dart';

enum TokenType { symbol, opUnion, opIntersection, opDifference, opSymDiff, lParen, rParen }

class Token {
  final TokenType type;
  final String value;
  Token(this.type, this.value);

  @override
  String toString() => 'Token($type, $value)';
}

class ExpressionParser {
  /// Tokenizes the expression string.
  static List<Token> tokenize(String expr) {
    final List<Token> tokens = [];
    int i = 0;
    while (i < expr.length) {
      final char = expr[i];

      if (char == ' ' || char == '\t' || char == '\n' || char == '\r') {
        i++;
        continue;
      }

      if (char == '(') {
        tokens.add(Token(TokenType.lParen, '('));
        i++;
      } else if (char == ')') {
        tokens.add(Token(TokenType.rParen, ')'));
        i++;
      } else if (char == '|') {
        tokens.add(Token(TokenType.opUnion, '|'));
        i++;
      } else if (char == '&') {
        tokens.add(Token(TokenType.opIntersection, '&'));
        i++;
      } else if (char == '-') {
        tokens.add(Token(TokenType.opDifference, '-'));
        i++;
      } else if (char == '^') {
        tokens.add(Token(TokenType.opSymDiff, '^'));
        i++;
      } else if (char == '*' || (char.codeUnitAt(0) >= 65 && char.codeUnitAt(0) <= 90)) {
        final start = i;
        while (i < expr.length && expr[i] == '*') {
          i++;
        }
        if (i < expr.length && expr[i].codeUnitAt(0) >= 65 && expr[i].codeUnitAt(0) <= 90) {
          i++;
          final symbol = expr.substring(start, i);
          tokens.add(Token(TokenType.symbol, symbol));
        } else {
          throw FormatException('Invalid symbol format at index $start');
        }
      } else {
        throw FormatException('Unexpected character "$char" at index $i');
      }
    }
    return tokens;
  }

  /// Evaluates the expression given a map of symbols to Set<Track>.
  static Set<Track> evaluate(String expr, Map<String, Set<Track>> setMap) {
    final tokens = tokenize(expr);
    if (tokens.isEmpty) return {};

    final evaluator = _Evaluator(tokens, setMap);
    final result = evaluator.parseExpression();
    if (evaluator.index < tokens.length) {
      throw FormatException('Trailing tokens found in expression');
    }
    return result;
  }
}

class _Evaluator {
  final List<Token> tokens;
  final Map<String, Set<Track>> setMap;
  int index = 0;

  _Evaluator(this.tokens, this.setMap);

  Set<Track> parseExpression() {
    var left = parseTerm();

    while (index < tokens.length) {
      final token = tokens[index];
      if (token.type == TokenType.opUnion || token.type == TokenType.opSymDiff) {
        index++;
        final right = parseTerm();
        if (token.type == TokenType.opUnion) {
          left = SetEngine.union(left, right);
        } else {
          left = SetEngine.symmetricDifference(left, right);
        }
      } else {
        break;
      }
    }

    return left;
  }

  Set<Track> parseTerm() {
    var left = parseFactor();

    while (index < tokens.length) {
      final token = tokens[index];
      if (token.type == TokenType.opIntersection || token.type == TokenType.opDifference) {
        index++;
        final right = parseFactor();
        if (token.type == TokenType.opIntersection) {
          left = SetEngine.intersection(left, right);
        } else {
          left = SetEngine.difference(left, right);
        }
      } else {
        break;
      }
    }

    return left;
  }

  Set<Track> parseFactor() {
    if (index >= tokens.length) {
      throw FormatException('Unexpected end of expression');
    }

    final token = tokens[index];
    if (token.type == TokenType.symbol) {
      index++;
      final tracks = setMap[token.value];
      if (tracks == null) {
        throw FormatException('Unknown symbol "${token.value}"');
      }
      return tracks;
    } else if (token.type == TokenType.lParen) {
      index++; // consume '('
      final result = parseExpression();
      if (index >= tokens.length || tokens[index].type != TokenType.rParen) {
        throw FormatException('Missing closing parenthesis');
      }
      index++; // consume ')'
      return result;
    } else {
      throw FormatException('Unexpected token "${token.value}"');
    }
  }
}
