export class TagsQLController {

  constructor(uiSegmentSrv, datasource, $q, targetSupplier)  {
    this.uiSegmentSrv = uiSegmentSrv;
    this.datasource = datasource;
    this.$q = $q;
    this.targetSupplier = targetSupplier;
    this.removeTagSegment = uiSegmentSrv.newSegment({fake: true, value: '-- Remove tag --'});
    this.removeValueSegment = uiSegmentSrv.newSegment({fake: true, value: '-- Remove value --'});
  }

  initTagsSegments() {
    let target = this.targetSupplier();
    if (!target.tagsQL && target.tags) {
      // Compatibility, switching from older version
      target.tagsQL = convertFromKVPairs(target.tags);
    }
    var segments = stringToSegments(target.tagsQL, this.uiSegmentSrv);
    segments.push(this.uiSegmentSrv.newPlusButton());
    // Fix plus-button: add it at the end of each enumeration
    var isInEnum = false;
    for (var i = 0; i < segments.length; i++) {
      if (segments[i].type === 'operator' && (segments[i].value === 'IN' || segments[i].value === 'NOT IN')) {
        isInEnum = true;
      } else if (isInEnum && segments[i].type !== 'value') {
        segments.splice(i, 0, this.uiSegmentSrv.newPlusButton());
        isInEnum = false;
      }
    }
    return segments;
  }

  getTagsSegments(segments, segment, $index) {
    // Get suggestions for available values in a given segment
    if (segment.type === 'condition') {
      return this.$q.when([this.uiSegmentSrv.newSegment('AND'), this.uiSegmentSrv.newSegment('OR')]);
    }
    if (segment.type === 'operator') {
      return this.$q.when(this.uiSegmentSrv.newOperators(['=', '!=', 'EXISTS', 'NOT EXISTS', 'IN', 'NOT IN']));
    }
    if (segment.type === 'plus-button') {
      // Find previous operator to know if we're in an enumeration
      var i = this.getContainingEnum(segments, $index);
      if (i > 0) {
        let key = segments[i-1].value;
        return this.datasource.suggestTags(this.targetSupplier().type, key)
          .then(this.uiSegmentSrv.transformToSegments(false));
      } else {
        return this.getTagKeys();
      }
    } else if (segment.type === 'key')  {
      return this.getTagKeys()
          .then(keys => [angular.copy(this.removeTagSegment)].concat(keys));
    } else if (segment.type === 'value')  {
      // Find preceding key
      var i = $index - 2;
      while (segments[i].type !== 'key') {
        i--;
      }
      let key = segments[i].value;
      var promise = this.datasource.suggestTags(this.targetSupplier().type, key)
        .then(this.uiSegmentSrv.transformToSegments(false));
      if (segments[$index-1].type === 'value') {
        // We're in an enumeration
        promise = promise.then(values => [angular.copy(this.removeValueSegment)].concat(values));
      }
      return promise;
    }
  }

  // Returns -1 if not in enum, or the index of the operator if in enum
  getContainingEnum(segments, $index) {
    // Find previous operator to know if we're in an enumeration
    var i = $index-1;
    while (i >= 0) {
      if (segments[i].type === 'operator') {
        if (segments[i].value === 'IN' || segments[i].value === 'NOT IN') {
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

  getTagKeys() {
    return this.datasource.suggestTagKeys()
      .then(this.uiSegmentSrv.transformToSegments(false));
  }

  tagsSegmentChanged(segments, segment, index) {
    if (segment.value === this.removeTagSegment.value) {
      // Remove the whole tag sequence
      // Compute number of segments to delete forward
      var nextSegment = index + 1;
      if (index > 0) {
        // Also remove preceding AND/OR segment
        index--;
      }
      while (nextSegment < segments.length) {
        if (segments[nextSegment].type === 'condition' || segments[nextSegment].type === 'plus-button') {
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
        segments.splice(index, 0,
          this.uiSegmentSrv.newKeyValue(segment.value),
          this.uiSegmentSrv.newPlusButton());
      } else {
        // Add a default model for tag: "<key> EXISTS"
        segments.splice(index, 0,
          this.uiSegmentSrv.newKey(segment.value),
          this.uiSegmentSrv.newOperator('EXISTS'),
          this.uiSegmentSrv.newPlusButton());
        if (index > 0) {
          // Add leading "AND"
          segments.splice(index, 0, this.uiSegmentSrv.newCondition('AND'));
        }
      }
    } else {
      if (segment.type === 'operator') {
        // Is there a change in number of operands?
        let needOneRightOperand = segment.value === '=' || segment.value === '!=';
        let isEnum = segment.value === 'IN' || segment.value === 'NOT IN';
        var currentRightOperands = 0;
        while (segments[index+currentRightOperands+1].type === 'value') {
          currentRightOperands++;
        }
        // If it's followed by a plus-button that is NOT the last element, then count it as a right operand as it must also be removed when we switch from enum to something else
        if (segments[index+currentRightOperands+1].type === 'plus-button' && index+currentRightOperands+2 < segments.length) {
          currentRightOperands++;
        }
        if (needOneRightOperand && currentRightOperands === 0) {
          // Add tag value
          segments.splice(index+1, 0, this.uiSegmentSrv.newKeyValue('select value'));
        } else if (needOneRightOperand && currentRightOperands > 1) {
          // Remove excedent
          segments.splice(index+2, currentRightOperands-1);
        } else if (!needOneRightOperand && !isEnum && currentRightOperands > 0) {
          // Remove values
          segments.splice(index+1, currentRightOperands);
        } else if (isEnum) {
          if (currentRightOperands === 0) {
            // Add a value and plus-button
            segments.splice(index+1, 0, this.uiSegmentSrv.newKeyValue('select value'), this.uiSegmentSrv.newPlusButton());
          } else if (currentRightOperands === 1) {
            // Just add plus-button after the value
            segments.splice(index+2, 0, this.uiSegmentSrv.newPlusButton());
          }
        }
      }
      segments[index] = segment;
    }
    this.targetSupplier().tagsQL = segmentsToString(segments);
  }
}

export function convertFromKVPairs(kvTags) {
  if (kvTags === undefined) {
    return undefined;
  }
  return kvTags.map(tag => {
    if (tag.value === '*' || tag.value === ' *') {
      return tag.name + " EXISTS";
    }
    return tag.name + "='" + tag.value + "'";
  }).join(' AND ');
}

export function segmentsToString(segments) {
  var strTags = "";
  var i = 0;
  while (i < segments.length) {
    strTags += segments[i++].value + " ";
    let op = segments[i++].value;
    strTags += op;
    if (op === '=' || op === '!=') {
      strTags += " '" + segments[i++].value + "'";
    } else if (op === 'IN' || op === 'NOT IN') {
      strTags += " [";
      var sep = "";
      while (i < segments.length && segments[i].type === 'value') {
        strTags += sep + "'" + segments[i++].value + "'";
        sep = ",";
      }
      strTags += "]";
    }
    if (i < segments.length) {
      if (segments[i].type === 'plus-button') {
        break;
      }
      // AND/OR
      strTags += " " + segments[i++].value + " ";
    }
  }
  return strTags;
}

export function stringToSegments(strTags, segmentFactory) {
  if (strTags === undefined) {
    return [];
  }
  var segments = [];
  var cursor = 0;
  var result;
  while (cursor < strTags.length) {
    if (cursor > 0) {
      result = readLogicalOp(strTags, cursor);
      cursor = result.cursor;
      segments.push(segmentFactory.newCondition(result.value));
    }
    result = readTagName(strTags, cursor);
    cursor = result.cursor;
    segments.push(segmentFactory.newKey(result.value));
    result = readRelationalOp(strTags, cursor);
    cursor = result.cursor;
    segments.push(segmentFactory.newOperator(result.value));
    if (result.value === '=' || result.value === '!=') {
      result = readTagValue(strTags, cursor);
      cursor = result.cursor;
      segments.push(segmentFactory.newKeyValue(result.value));
    } else if (result.value === 'IN' || result.value === 'NOT IN') {
      result = readEnumeration(strTags, cursor);
      cursor = result.cursor;
      for (let value of result.values) {
        segments.push(segmentFactory.newKeyValue(value));
      }
    }
    cursor = skipWhile(strTags, cursor, c => c === ' ');
  }
  return segments;
}

function readLogicalOp(strTags, cursor) {
  cursor = skipWhile(strTags, cursor, c => c === ' ');
  if (strTags.substr(cursor, 2).toUpperCase() === 'OR') {
    return { cursor: cursor + 2, value: 'OR' };
  }
  if (strTags.substr(cursor, 3).toUpperCase() === 'AND') {
    return { cursor: cursor + 3, value: 'AND' };
  }
  throw "Cannot parse tags string: logical operator expected near '" + strTags.substr(cursor, 15) + "'";
}

function readTagName(strTags, cursor) {
  cursor = skipWhile(strTags, cursor, c => c === ' ');
  var first = cursor;
  cursor = skipWhileNextNotIn(strTags, cursor, [' ', '=', '!=']);
  return { cursor: cursor, value: strTags.substr(first, cursor - first) };
}

function readRelationalOp(strTags, cursor) {
  cursor = skipWhile(strTags, cursor, c => c === ' ');
  if (strTags.substr(cursor, 1).toUpperCase() === '=') {
    return { cursor: cursor + 1, value: '=' };
  }
  if (strTags.substr(cursor, 2).toUpperCase() === '!=') {
    return { cursor: cursor + 2, value: '!=' };
  }
  if (strTags.substr(cursor, 6).toUpperCase() === 'EXISTS') {
    return { cursor: cursor + 6, value: 'EXISTS' };
  }
  if (strTags.substr(cursor, 10).toUpperCase() === 'NOT EXISTS') {
    return { cursor: cursor + 10, value: 'NOT EXISTS' };
  }
  if (strTags.substr(cursor, 2).toUpperCase() === 'IN') {
    return { cursor: cursor + 2, value: 'IN' };
  }
  if (strTags.substr(cursor, 6).toUpperCase() === 'NOT IN') {
    return { cursor: cursor + 6, value: 'NOT IN' };
  }
  throw "Cannot parse tags string: relational operator expected near '" + strTags.substr(cursor, 15) + "'";
}

function readTagValue(strTags, cursor) {
  let first = skipWhile(strTags, cursor, c => c === ' ');
  if (strTags.charAt(first) === '"') {
    cursor = skipWhile(strTags, first+1, c => c !== '"');
    return { cursor: cursor+1, value: strTags.substr(first+1, cursor - first - 1) };
  } else if (strTags.charAt(first) === "'") {
    cursor = skipWhile(strTags, first+1, c => c !== "'");
    return { cursor: cursor+1, value: strTags.substr(first+1, cursor - first - 1) };
  }
  cursor = skipWhile(strTags, first, c => c !== ' ' && c !== ',');
  return { cursor: cursor, value: strTags.substr(first, cursor - first) };
}

function readEnumeration(strTags, cursor) {
  var values = [];
  cursor = skipWhile(strTags, cursor, c => c !== '[') + 1;
  // let end = skipWhile(strTags, start, c => c !== ']') - 1;
  // let enumStr = strTags.substr(start, end - start);
  // cursor = 0;
  while (cursor < strTags.length) {
    var result = readTagValue(strTags, cursor);
    values.push(result.value);
    cursor = skipWhile(strTags, result.cursor, c => c === ' ');
    if (strTags.charAt(cursor) === ']') {
      cursor++;
      break;
    }
    if (strTags.charAt(cursor) === ',') {
      cursor++;
    } else {
      throw "Cannot parse tags string: unexpected token in enumeration near '" + strTags.substr(cursor, 15) + "'";
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
    for (let expect of nextList) {
      let actual = strTags.substr(cursor, expect.length);
      if (actual === expect) {
        return cursor;
      }
    }
    cursor++;
  }
  return cursor;
}
