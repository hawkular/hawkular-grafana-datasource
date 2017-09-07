// "Natural language" operators
const OPERATOR_EQ = '=';
const OPERATOR_NOTEQ = '!=';
const OPERATOR_IN = 'is in';
const OPERATOR_NOTIN = 'is not in';
const OPERATOR_EXISTS = 'exists';
const OPERATOR_NOTEXISTS = 'doesn\'t exist';
const OPERATOR_AND = 'AND';
const OPERATOR_OR = 'OR';

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
    const target = this.targetSupplier();
    if (!target.tagsQL && target.tags) {
      // Compatibility, switching from older version
      target.tagsQL = convertFromKVPairs(target.tags);
    }
    let segments = stringToSegments(target.tagsQL, this.uiSegmentSrv);
    segments.push(this.uiSegmentSrv.newPlusButton());
    // Fix plus-button: add it at the end of each enumeration
    let isInEnum = false;
    for (let i = 0; i < segments.length; i++) {
      if (segments[i].type === 'operator' && (segments[i].value === OPERATOR_IN || segments[i].value === OPERATOR_NOTIN)) {
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
      return this.$q.when([this.uiSegmentSrv.newSegment(OPERATOR_AND), this.uiSegmentSrv.newSegment(OPERATOR_OR)]);
    }
    if (segment.type === 'operator') {
      return this.$q.when(this.uiSegmentSrv.newOperators([OPERATOR_EQ, OPERATOR_NOTEQ, OPERATOR_EXISTS, OPERATOR_NOTEXISTS, OPERATOR_IN, OPERATOR_NOTIN]));
    }
    if (segment.type === 'plus-button') {
      // Find previous operator to know if we're in an enumeration
      let i = this.getContainingEnum(segments, $index);
      if (i > 0) {
        const key = segments[i-1].value;
        return this.datasource.suggestTags(this.targetSupplier(), key)
          .then(this.uiSegmentSrv.transformToSegments(false));
      } else {
        return this.getTagKeys();
      }
    } else if (segment.type === 'key')  {
      return this.getTagKeys()
          .then(keys => [angular.copy(this.removeTagSegment), ...keys]);
    } else if (segment.type === 'value')  {
      // Find preceding key
      let i = $index - 2;
      while (segments[i].type !== 'key') {
        i--;
      }
      const key = segments[i].value;
      let promise = this.datasource.suggestTags(this.targetSupplier(), key)
        .then(this.uiSegmentSrv.transformToSegments(false));
      if (segments[$index-1].type === 'value') {
        // We're in an enumeration
        promise = promise.then(values => [angular.copy(this.removeValueSegment), ...values]);
      }
      return promise;
    }
  }

  // Returns -1 if not in enum, or the index of the operator if in enum
  getContainingEnum(segments, $index) {
    // Find previous operator to know if we're in an enumeration
    let i = $index-1;
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

  getTagKeys() {
    return this.datasource.suggestTagKeys(this.targetSupplier())
      .then(this.uiSegmentSrv.transformToSegments(false));
  }

  tagsSegmentChanged(segments, segment, index) {
    if (segment.value === this.removeTagSegment.value) {
      // Remove the whole tag sequence
      // Compute number of segments to delete forward
      let nextSegment = index + 1;
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
      let i = this.getContainingEnum(segments, index);
      if (i > 0) {
        // We're in an enum, so add value
        segments.splice(index, 0,
          this.uiSegmentSrv.newKeyValue(segment.value),
          this.uiSegmentSrv.newPlusButton());
      } else {
        // Add a default model for tag: "<key> EXISTS"
        segments.splice(index, 0,
          this.uiSegmentSrv.newKey(segment.value),
          this.uiSegmentSrv.newOperator(OPERATOR_EXISTS),
          this.uiSegmentSrv.newPlusButton());
        if (index > 0) {
          // Add leading "AND"
          segments.splice(index, 0, this.uiSegmentSrv.newCondition(OPERATOR_AND));
        }
      }
    } else {
      if (segment.type === 'operator') {
        // Is there a change in number of operands?
        const needOneRightOperand = segment.value === OPERATOR_EQ || segment.value === OPERATOR_NOTEQ;
        const isEnum = segment.value === OPERATOR_IN || segment.value === OPERATOR_NOTIN;
        let currentRightOperands = 0;
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
      return tag.name;
    }
    if (tag.value.charAt(0) === '$') {
      // it's a variable
      return `${tag.name} IN [${tag.value}]`;
    }
    return `${tag.name}='${tag.value}'`;
  }).join(' AND ');
}

// Example:
// Input segment values: ["fruit", "is in", "pear", "apple", "peach", "<plus-button>", "AND", "color", "=", "green", "<plus-button>"]
// Output string: "fruit IN [pear, apple, peach] AND color=green"
export function segmentsToString(segments) {
  let strTags = '';
  let i = 0;
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
    const tagName = segments[i++].value;
    // Operator
    const op = segments[i++].value;
    if (op === OPERATOR_EQ || op === OPERATOR_NOTEQ) {
      strTags += tagName + op + valueToString(segments[i++].value);
    } else if (op === OPERATOR_EXISTS) {
      strTags += tagName;
    } else if (op === OPERATOR_NOTEXISTS) {
      strTags += 'NOT ' + tagName;
    } else if (op === OPERATOR_IN) {
      const v = valuesToString(segments, i);
      i = v.i;
      strTags += `${tagName} IN [${v.values}]`;
    } else if (op === OPERATOR_NOTIN) {
      const v = valuesToString(segments, i);
      i = v.i;
      strTags += `${tagName} NOT IN [${v.values}]`;
    }
  }
  return strTags;
}

function valuesToString(segments, i) {
  let values = '';
  let sep = '';
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
  if ((value.charAt(0) === "'" && value.charAt(value.length-1) === "'")
      || value.match(/^\$?[a-zA-Z0-9_.]+$/g)) {
    // Variable, simple literal or already single-quoted => keep as is
    return value;
  }
  return `'${value}'`;
}

// Example:
// Input string: "fruit IN [pear, apple, peach] AND color=green"
// Output segment values: ["fruit", "is in", "pear", "apple", "peach", "<plus-button>", "AND", "color", "=", "green", "<plus-button>"]
export function stringToSegments(strTags, segmentFactory) {
  if (strTags === undefined) {
    return [];
  }
  let segments = [];
  let cursor = 0;
  let result;
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
      const nextCursor = skipWhile(strTags, result.cursor, c => c === ' ');
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
          for (let value of result.values) {
            segments.push(segmentFactory.newKeyValue(value));
          }
        }
      }
    }
    cursor = skipWhile(strTags, cursor, c => c === ' ');
  }
  return segments;
}

function readLogicalOp(strTags, cursor) {
  cursor = skipWhile(strTags, cursor, c => c === ' ');
  if (strTags.substr(cursor, 2).toUpperCase() === 'OR') {
    return { cursor: cursor + 2, value: OPERATOR_OR };
  }
  if (strTags.substr(cursor, 3).toUpperCase() === 'AND') {
    return { cursor: cursor + 3, value: OPERATOR_AND };
  }
  throw `Cannot parse tags string: logical operator expected near '${strTags.substr(cursor, 15)}'`;
}

function readWord(strTags, cursor) {
  cursor = skipWhile(strTags, cursor, c => c === ' ');
  const remaining = strTags.substr(cursor);
  if (remaining.charAt(0) === "'") {
    const first = cursor;
    cursor = skipWhile(strTags, first+1, c => c !== "'") + 1;
    return { cursor: cursor, value: strTags.substr(first, cursor - first) };
  }
  const word = remaining.match(/^(\$?[a-zA-Z0-9_.]*)/)[0];
  cursor += word.length;
  return { cursor: cursor, value: word };
}

function readRelationalOp(strTags, cursor) {
  cursor = skipWhile(strTags, cursor, c => c === ' ');
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
  throw `Cannot parse tags string: relational operator expected near '${strTags.substr(cursor, 15)}'`;
}

function readEnumeration(strTags, cursor) {
  let values = [];
  cursor = skipWhile(strTags, cursor, c => c !== '[') + 1;
  while (cursor < strTags.length) {
    let result = readWord(strTags, cursor);
    values.push(result.value);
    cursor = skipWhile(strTags, result.cursor, c => c === ' ');
    if (strTags.charAt(cursor) === ']') {
      cursor++;
      break;
    }
    if (strTags.charAt(cursor) === ',') {
      cursor++;
    } else {
      throw `Cannot parse tags string: unexpected token in enumeration near '${strTags.substr(cursor, 15)}'`;
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
      const actual = strTags.substr(cursor, expect.length);
      if (actual === expect) {
        return cursor;
      }
    }
    cursor++;
  }
  return cursor;
}
