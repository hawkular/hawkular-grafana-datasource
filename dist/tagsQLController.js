'use strict';

System.register([], function (_export, _context) {
  "use strict";

  var _createClass, OPERATOR_EQ, OPERATOR_NOTEQ, OPERATOR_IN, OPERATOR_NOTIN, OPERATOR_EXISTS, OPERATOR_NOTEXISTS, OPERATOR_AND, OPERATOR_OR, TagsQLController;

  function _toConsumableArray(arr) {
    if (Array.isArray(arr)) {
      for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) {
        arr2[i] = arr[i];
      }

      return arr2;
    } else {
      return Array.from(arr);
    }
  }

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  function convertFromKVPairs(kvTags) {
    if (kvTags === undefined) {
      return undefined;
    }
    return kvTags.map(function (tag) {
      if (tag.value === '*' || tag.value === ' *') {
        return tag.name;
      }
      if (tag.value.charAt(0) === '$') {
        // it's a variable
        return tag.name + ' IN [' + tag.value + ']';
      }
      return tag.name + '=\'' + tag.value + '\'';
    }).join(' AND ');
  }

  // Example:
  // Input segment values: ["fruit", "is in", "pear", "apple", "peach", "<plus-button>", "AND", "color", "=", "green", "<plus-button>"]
  // Output string: "fruit IN [pear, apple, peach] AND color=green"

  _export('convertFromKVPairs', convertFromKVPairs);

  function segmentsToString(segments) {
    var strTags = '';
    var i = 0;
    while (i < segments.length) {
      if (segments[i].type === 'plus-button') {
        i++;
        continue;
      }
      if (i != 0) {
        // AND/OR
        strTags += ' ' + segments[i++].value + ' ';
      }
      // Tag name
      var tagName = segments[i++].value;
      // Operator
      var op = segments[i++].value;
      if (op === OPERATOR_EQ || op === OPERATOR_NOTEQ) {
        strTags += tagName + op + valueToString(segments[i++].value);
      } else if (op === OPERATOR_EXISTS) {
        strTags += tagName;
      } else if (op === OPERATOR_NOTEXISTS) {
        strTags += 'NOT ' + tagName;
      } else if (op === OPERATOR_IN) {
        var v = valuesToString(segments, i);
        i = v.i;
        strTags += tagName + ' IN [' + v.values + ']';
      } else if (op === OPERATOR_NOTIN) {
        var _v = valuesToString(segments, i);
        i = _v.i;
        strTags += tagName + ' NOT IN [' + _v.values + ']';
      }
    }
    return strTags;
  }

  _export('segmentsToString', segmentsToString);

  function valuesToString(segments, i) {
    var values = '';
    var sep = '';
    while (i < segments.length && segments[i].type === 'value') {
      values += sep + valueToString(segments[i++].value);
      sep = ',';
    }
    return {
      values: values,
      i: i
    };
  }

  function valueToString(value) {
    if (value.charAt(0) === "'" && value.charAt(value.length - 1) === "'" || value.match(/^\$?[a-zA-Z0-9_.]+$/g)) {
      // Variable, simple literal or already single-quoted => keep as is
      return value;
    }
    return '\'' + value + '\'';
  }

  // Example:
  // Input string: "fruit IN [pear, apple, peach] AND color=green"
  // Output segment values: ["fruit", "is in", "pear", "apple", "peach", "<plus-button>", "AND", "color", "=", "green", "<plus-button>"]
  function stringToSegments(strTags, segmentFactory) {
    if (strTags === undefined) {
      return [];
    }
    var segments = [];
    var cursor = 0;
    var result = void 0;
    while (cursor < strTags.length) {
      if (cursor > 0) {
        result = readLogicalOp(strTags, cursor);
        cursor = result.cursor;
        segments.push(segmentFactory.newCondition(result.value));
      }
      result = readWord(strTags, cursor);
      cursor = result.cursor;
      if (result.value.toUpperCase() === 'NOT') {
        // Special case, 'not' keyword may be be read instead of tag name
        result = readWord(strTags, cursor);
        cursor = result.cursor;
        segments.push(segmentFactory.newKey(result.value));
        segments.push(segmentFactory.newOperator(OPERATOR_NOTEXISTS));
      } else {
        // It's tag name
        segments.push(segmentFactory.newKey(result.value));
        // Check next word without increasing cursor: if it's a logical operator, we're on an "exists" operation
        result = readWord(strTags, cursor);
        var nextCursor = skipWhile(strTags, result.cursor, function (c) {
          return c === ' ';
        });
        if (nextCursor >= strTags.length || result.value === OPERATOR_AND || result.value === OPERATOR_OR) {
          segments.push(segmentFactory.newOperator(OPERATOR_EXISTS));
        } else {
          // Relational operation
          result = readRelationalOp(strTags, cursor);
          cursor = result.cursor;
          segments.push(segmentFactory.newOperator(result.value));
          if (result.value === '=' || result.value === '!=') {
            result = readWord(strTags, cursor);
            cursor = result.cursor;
            segments.push(segmentFactory.newKeyValue(result.value));
          } else {
            // Enumeration
            result = readEnumeration(strTags, cursor);
            cursor = result.cursor;
            var _iteratorNormalCompletion = true;
            var _didIteratorError = false;
            var _iteratorError = undefined;

            try {
              for (var _iterator = result.values[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                var value = _step.value;

                segments.push(segmentFactory.newKeyValue(value));
              }
            } catch (err) {
              _didIteratorError = true;
              _iteratorError = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion && _iterator.return) {
                  _iterator.return();
                }
              } finally {
                if (_didIteratorError) {
                  throw _iteratorError;
                }
              }
            }
          }
        }
      }
      cursor = skipWhile(strTags, cursor, function (c) {
        return c === ' ';
      });
    }
    return segments;
  }

  _export('stringToSegments', stringToSegments);

  function readLogicalOp(strTags, cursor) {
    cursor = skipWhile(strTags, cursor, function (c) {
      return c === ' ';
    });
    if (strTags.substr(cursor, 2).toUpperCase() === 'OR') {
      return { cursor: cursor + 2, value: OPERATOR_OR };
    }
    if (strTags.substr(cursor, 3).toUpperCase() === 'AND') {
      return { cursor: cursor + 3, value: OPERATOR_AND };
    }
    throw 'Cannot parse tags string: logical operator expected near \'' + strTags.substr(cursor, 15) + '\'';
  }

  function readWord(strTags, cursor) {
    cursor = skipWhile(strTags, cursor, function (c) {
      return c === ' ';
    });
    var remaining = strTags.substr(cursor);
    if (remaining.charAt(0) === "'") {
      var first = cursor;
      cursor = skipWhile(strTags, first + 1, function (c) {
        return c !== "'";
      }) + 1;
      return { cursor: cursor, value: strTags.substr(first, cursor - first) };
    }
    var word = remaining.match(/^(\$?[a-zA-Z0-9_.]*)/)[0];
    cursor += word.length;
    return { cursor: cursor, value: word };
  }

  function readRelationalOp(strTags, cursor) {
    cursor = skipWhile(strTags, cursor, function (c) {
      return c === ' ';
    });
    if (strTags.substr(cursor, 1).toUpperCase() === '=') {
      return { cursor: cursor + 1, value: OPERATOR_EQ };
    }
    if (strTags.substr(cursor, 2).toUpperCase() === '!=') {
      return { cursor: cursor + 2, value: OPERATOR_NOTEQ };
    }
    if (strTags.substr(cursor, 2).toUpperCase() === 'IN') {
      return { cursor: cursor + 2, value: OPERATOR_IN };
    }
    if (strTags.substr(cursor, 6).toUpperCase() === 'NOT IN') {
      return { cursor: cursor + 6, value: OPERATOR_NOTIN };
    }
    throw 'Cannot parse tags string: relational operator expected near \'' + strTags.substr(cursor, 15) + '\'';
  }

  function readEnumeration(strTags, cursor) {
    var values = [];
    cursor = skipWhile(strTags, cursor, function (c) {
      return c !== '[';
    }) + 1;
    while (cursor < strTags.length) {
      var result = readWord(strTags, cursor);
      values.push(result.value);
      cursor = skipWhile(strTags, result.cursor, function (c) {
        return c === ' ';
      });
      if (strTags.charAt(cursor) === ']') {
        cursor++;
        break;
      }
      if (strTags.charAt(cursor) === ',') {
        cursor++;
      } else {
        throw 'Cannot parse tags string: unexpected token in enumeration near \'' + strTags.substr(cursor, 15) + '\'';
      }
    }
    return { cursor: cursor, values: values };
  }

  function skipWhile(strTags, cursor, cond) {
    while (cursor < strTags.length && cond(strTags.charAt(cursor))) {
      cursor++;
    }
    return cursor;
  }

  function skipWhileNextNotIn(strTags, cursor, nextList) {
    while (cursor < strTags.length) {
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;
      var _iteratorError2 = undefined;

      try {
        for (var _iterator2 = nextList[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          var expect = _step2.value;

          var actual = strTags.substr(cursor, expect.length);
          if (actual === expect) {
            return cursor;
          }
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return) {
            _iterator2.return();
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }

      cursor++;
    }
    return cursor;
  }
  return {
    setters: [],
    execute: function () {
      _createClass = function () {
        function defineProperties(target, props) {
          for (var i = 0; i < props.length; i++) {
            var descriptor = props[i];
            descriptor.enumerable = descriptor.enumerable || false;
            descriptor.configurable = true;
            if ("value" in descriptor) descriptor.writable = true;
            Object.defineProperty(target, descriptor.key, descriptor);
          }
        }

        return function (Constructor, protoProps, staticProps) {
          if (protoProps) defineProperties(Constructor.prototype, protoProps);
          if (staticProps) defineProperties(Constructor, staticProps);
          return Constructor;
        };
      }();

      OPERATOR_EQ = '=';
      OPERATOR_NOTEQ = '!=';
      OPERATOR_IN = 'is in';
      OPERATOR_NOTIN = 'is not in';
      OPERATOR_EXISTS = 'exists';
      OPERATOR_NOTEXISTS = 'doesn\'t exist';
      OPERATOR_AND = 'AND';
      OPERATOR_OR = 'OR';

      _export('TagsQLController', TagsQLController = function () {
        function TagsQLController(uiSegmentSrv, datasource, $q, targetSupplier) {
          _classCallCheck(this, TagsQLController);

          this.uiSegmentSrv = uiSegmentSrv;
          this.datasource = datasource;
          this.$q = $q;
          this.targetSupplier = targetSupplier;
          this.removeTagSegment = uiSegmentSrv.newSegment({ fake: true, value: '-- Remove tag --' });
          this.removeValueSegment = uiSegmentSrv.newSegment({ fake: true, value: '-- Remove value --' });
        }

        _createClass(TagsQLController, [{
          key: 'initTagsSegments',
          value: function initTagsSegments() {
            var target = this.targetSupplier();
            if (!target.tagsQL && target.tags) {
              // Compatibility, switching from older version
              target.tagsQL = convertFromKVPairs(target.tags);
            }
            var segments = stringToSegments(target.tagsQL, this.uiSegmentSrv);
            segments.push(this.uiSegmentSrv.newPlusButton());
            // Fix plus-button: add it at the end of each enumeration
            var isInEnum = false;
            for (var i = 0; i < segments.length; i++) {
              if (segments[i].type === 'operator' && (segments[i].value === OPERATOR_IN || segments[i].value === OPERATOR_NOTIN)) {
                isInEnum = true;
              } else if (isInEnum && segments[i].type !== 'value') {
                segments.splice(i, 0, this.uiSegmentSrv.newPlusButton());
                isInEnum = false;
              }
            }
            return segments;
          }
        }, {
          key: 'getTagsSegments',
          value: function getTagsSegments(segments, segment, $index) {
            var _this = this;

            // Get suggestions for available values in a given segment
            if (segment.type === 'condition') {
              return this.$q.when([this.uiSegmentSrv.newSegment(OPERATOR_AND), this.uiSegmentSrv.newSegment(OPERATOR_OR)]);
            }
            if (segment.type === 'operator') {
              return this.$q.when(this.uiSegmentSrv.newOperators([OPERATOR_EQ, OPERATOR_NOTEQ, OPERATOR_EXISTS, OPERATOR_NOTEXISTS, OPERATOR_IN, OPERATOR_NOTIN]));
            }
            if (segment.type === 'plus-button') {
              // Find previous operator to know if we're in an enumeration
              var i = this.getContainingEnum(segments, $index);
              if (i > 0) {
                var key = segments[i - 1].value;
                return this.datasource.suggestTags(this.targetSupplier(), key).then(this.uiSegmentSrv.transformToSegments(false));
              } else {
                return this.getTagKeys();
              }
            } else if (segment.type === 'key') {
              return this.getTagKeys().then(function (keys) {
                return [angular.copy(_this.removeTagSegment)].concat(_toConsumableArray(keys));
              });
            } else if (segment.type === 'value') {
              // Find preceding key
              var _i = $index - 2;
              while (segments[_i].type !== 'key') {
                _i--;
              }
              var _key = segments[_i].value;
              var promise = this.datasource.suggestTags(this.targetSupplier(), _key).then(this.uiSegmentSrv.transformToSegments(false));
              if (segments[$index - 1].type === 'value') {
                // We're in an enumeration
                promise = promise.then(function (values) {
                  return [angular.copy(_this.removeValueSegment)].concat(_toConsumableArray(values));
                });
              }
              return promise;
            }
          }
        }, {
          key: 'getContainingEnum',
          value: function getContainingEnum(segments, $index) {
            // Find previous operator to know if we're in an enumeration
            var i = $index - 1;
            while (i >= 0) {
              if (segments[i].type === 'operator') {
                if (segments[i].value === OPERATOR_IN || segments[i].value === OPERATOR_NOTIN) {
                  return i;
                }
                return -1;
              }
              if (segments[i].type === 'plus-button') {
                // There can be several plus-buttons. In that case, the user selected the last plus-button, ie. the one related to adding a new tag.
                return -1;
              }
              i--;
            }
            return -1;
          }
        }, {
          key: 'getTagKeys',
          value: function getTagKeys() {
            return this.datasource.suggestTagKeys(this.targetSupplier()).then(this.uiSegmentSrv.transformToSegments(false));
          }
        }, {
          key: 'tagsSegmentChanged',
          value: function tagsSegmentChanged(segments, segment, index) {
            if (segment.value === this.removeTagSegment.value) {
              // Remove the whole tag sequence
              // Compute number of segments to delete forward
              var nextSegment = index + 1;
              if (index > 0) {
                // Also remove preceding AND/OR segment
                index--;
              }
              while (nextSegment < segments.length) {
                if (nextSegment === segments.length - 1) {
                  break;
                }
                if (segments[nextSegment].type === 'condition') {
                  if (index === 0) {
                    // Don't start query with a AND or OR, remove it.
                    nextSegment++;
                  }
                  break;
                }
                nextSegment++;
              }
              segments.splice(index, nextSegment - index);
            } else if (segment.value === this.removeValueSegment.value) {
              // We must be deleting a value from an enumeration
              segments.splice(index, 1);
            } else if (segment.type === 'plus-button') {
              // Remove plus button
              segments.splice(index, 1);
              var i = this.getContainingEnum(segments, index);
              if (i > 0) {
                // We're in an enum, so add value
                segments.splice(index, 0, this.uiSegmentSrv.newKeyValue(segment.value), this.uiSegmentSrv.newPlusButton());
              } else {
                // Add a default model for tag: "<key> EXISTS"
                segments.splice(index, 0, this.uiSegmentSrv.newKey(segment.value), this.uiSegmentSrv.newOperator(OPERATOR_EXISTS), this.uiSegmentSrv.newPlusButton());
                if (index > 0) {
                  // Add leading "AND"
                  segments.splice(index, 0, this.uiSegmentSrv.newCondition(OPERATOR_AND));
                }
              }
            } else {
              if (segment.type === 'operator') {
                // Is there a change in number of operands?
                var needOneRightOperand = segment.value === OPERATOR_EQ || segment.value === OPERATOR_NOTEQ;
                var isEnum = segment.value === OPERATOR_IN || segment.value === OPERATOR_NOTIN;
                var currentRightOperands = 0;
                while (segments[index + currentRightOperands + 1].type === 'value') {
                  currentRightOperands++;
                }
                // If it's followed by a plus-button that is NOT the last element, then count it as a right operand as it must also be removed when we switch from enum to something else
                if (segments[index + currentRightOperands + 1].type === 'plus-button' && index + currentRightOperands + 2 < segments.length) {
                  currentRightOperands++;
                }
                if (needOneRightOperand && currentRightOperands === 0) {
                  // Add tag value
                  segments.splice(index + 1, 0, this.uiSegmentSrv.newKeyValue('select value'));
                } else if (needOneRightOperand && currentRightOperands > 1) {
                  // Remove excedent
                  segments.splice(index + 2, currentRightOperands - 1);
                } else if (!needOneRightOperand && !isEnum && currentRightOperands > 0) {
                  // Remove values
                  segments.splice(index + 1, currentRightOperands);
                } else if (isEnum) {
                  if (currentRightOperands === 0) {
                    // Add a value and plus-button
                    segments.splice(index + 1, 0, this.uiSegmentSrv.newKeyValue('select value'), this.uiSegmentSrv.newPlusButton());
                  } else if (currentRightOperands === 1) {
                    // Just add plus-button after the value
                    segments.splice(index + 2, 0, this.uiSegmentSrv.newPlusButton());
                  }
                }
              }
              segments[index] = segment;
            }
            this.targetSupplier().tagsQL = segmentsToString(segments);
          }
        }]);

        return TagsQLController;
      }());

      _export('TagsQLController', TagsQLController);
    }
  };
});
//# sourceMappingURL=tagsQLController.js.map
