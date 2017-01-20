export class TagsQLController {

  constructor(uiSegmentSrv, datasource, $q, targetSupplier)  {
    this.uiSegmentSrv = uiSegmentSrv;
    this.datasource = datasource;
    this.$q = $q;
    this.targetSupplier = targetSupplier;
    this.removeTagsSegment = uiSegmentSrv.newSegment({fake: true, value: '-- Remove tag --'});
  }

  initTagsSegments() {
    let target = this.targetSupplier();
    if (!target.tagsQL && target.tags) {
      // Compatibility, switching from older version
      target.tagsQL = convertFromKVPairs(target.tags);
    }
    var segments = stringToSegments(target.tagsQL, this.uiSegmentSrv);
    segments.push(this.uiSegmentSrv.newPlusButton());
    return segments;
  }

  getTagsSegments(segments, segment, $index) {
    // Get suggestions for available values in a given segment
    if (segment.type === 'condition') {
      return this.$q.when([this.uiSegmentSrv.newSegment('AND'), this.uiSegmentSrv.newSegment('OR')]);
    }
    if (segment.type === 'operator') {
      return this.$q.when(this.uiSegmentSrv.newOperators(['=', '!=', 'EXISTS', 'NOT EXISTS']));
    }
    if (segment.type === 'plus-button') {
      return this.getTagKeys();
    } else if (segment.type === 'key')  {
      return this.getTagKeys()
          .then(keys => [angular.copy(this.removeTagsSegment)].concat(keys));
    } else if (segment.type === 'value')  {
      var key = segments[$index-2].value;
      return this.datasource.suggestTags(this.targetSupplier().type, key)
        .then(this.uiSegmentSrv.transformToSegments(false));
    }
  }

  getTagKeys() {
    return this.datasource.suggestTagKeys()
      .then(this.uiSegmentSrv.transformToSegments(false));
  }

  tagsSegmentChanged(segments, segment, index) {
    if (segment.value === this.removeTagsSegment.value) {
      // Current segment must be a tag-key segment
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
    } else if (segment.type === 'plus-button') {
      // Remove plus button
      segments.splice(index, 1);
      // Add a default model for tag: "<key> EXISTS"
      segments.splice(index, 0,
        this.uiSegmentSrv.newKey(segment.value),
        this.uiSegmentSrv.newOperator('EXISTS'),
        this.uiSegmentSrv.newPlusButton());
      if (index > 0) {
        // Add leading "AND"
        segments.splice(index, 0, this.uiSegmentSrv.newCondition('AND'));
      }
    } else {
      if (segment.type === 'operator') {
        // Is there a change in number of operands?
        let needRightOperand = segment.value === '=' || segment.value === '!=';
        let hasRightOperand = segments[index+1].type === 'value';
        if (hasRightOperand && !needRightOperand) {
          // Remove tag value
          segments.splice(index+1, 1);
        } else if (!hasRightOperand && needRightOperand) {
          // Add tag value
          segments.splice(index+1, 0, this.uiSegmentSrv.newKeyValue('select value'));
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
    }
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
  throw "Cannot parse tags string: relational operator expected near '" + strTags.substr(cursor, 15) + "'";
}

function readTagValue(strTags, cursor) {
  cursor = skipWhile(strTags, cursor, c => c === ' ');
  var first = cursor;
  var endingChar = ' ';
  if (strTags.charAt(first) === '"') {
    endingChar = '"';
    cursor++;
    first++;
  } else if (strTags.charAt(first) === "'") {
    endingChar = "'";
    cursor++;
    first++;
  }
  cursor = skipWhile(strTags, cursor, c => c !== endingChar);
  let value = strTags.substr(first, cursor - first);
  if (endingChar !== ' ') {
    cursor++;
  }
  return { cursor: cursor, value: value };
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
