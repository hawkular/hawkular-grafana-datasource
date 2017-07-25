import _ from 'lodash';

export class TagsKVPairsController {

  constructor(uiSegmentSrv, datasource, $q, fetchAllTagsCapability, targetSupplier)  {
    this.uiSegmentSrv = uiSegmentSrv;
    this.datasource = datasource;
    this.$q = $q;
    this.fetchAllTagsCapability = fetchAllTagsCapability;
    this.targetSupplier = targetSupplier;
    this.removeTagsSegment = uiSegmentSrv.newSegment({fake: true, value: '-- Remove tag --'});
    this.modelToSegments = modelToSegments;
    this.segmentsToModel = segmentsToModel;
  }

  initTagsSegments() {
    let segments = modelToSegments(this.targetSupplier().tags, this.uiSegmentSrv);
    segments.push(this.uiSegmentSrv.newPlusButton());
    return segments;
  }

  getTagsSegments(segments, segment, $index) {
    if (segment.type === 'plus-button') {
      return this.getTagKeys();
    } else if (segment.type === 'key')  {
      return this.getTagKeys()
          .then(keys => [angular.copy(this.removeTagsSegment), ...keys]);
    } else if (segment.type === 'value')  {
      let key = segments[$index-2].value;
      return this.datasource.suggestTags(this.targetSupplier(), key)
        .then(tags => [{text: ' *', value: ' *'}, ...tags])
        .then(this.uiSegmentSrv.transformToSegments(false));
    }
  }

  getTagKeys() {
    if (this.fetchAllTagsCapability) {
      return this.datasource.suggestTagKeys(this.targetSupplier())
        .then(this.uiSegmentSrv.transformToSegments(false));
    } else {
      return this.$q.when([]);
    }
  }

  tagsSegmentChanged(segments, segment, index) {
    if (segment.value === this.removeTagsSegment.value) {
      segments.splice(index, 4);
    } else if (segment.type === 'plus-button') {
      segments.splice(index, 1);
      segments.splice(index, 0,
        this.uiSegmentSrv.newKey(segment.value),
        this.uiSegmentSrv.newOperator(':'),
        this.uiSegmentSrv.newKeyValue(' *'),
        this.uiSegmentSrv.newOperator(','),
        this.uiSegmentSrv.newPlusButton());
    } else {
      segments[index] = segment;
    }
    this.targetSupplier().tags = segmentsToModel(segments);
  }
}

export function segmentsToModel(segments) {
  // or "serialize"
  let tags = [];
  for (let i = 0; i < segments.length - 2; i += 4) {
    const key = segments[i].value;
    let val = segments[i+2].fake ? '*' : segments[i+2].value;
    if (!val || val === ' *') {
      // '*' character get a special treatment in grafana so we had to use ' *' instead
      val = '*';
    }
    tags.push({name: key, value: val});
  }
  return tags;
}

export function modelToSegments(tags, segmentFactory) {
  // or "deserialize"
  return _.reduce(tags, (list, tag) => {
      list.push(segmentFactory.newKey(tag.name));
      list.push(segmentFactory.newOperator(':'));
      if (tag.value === '*') {
        list.push(segmentFactory.newKeyValue(' *'));
      } else {
        list.push(segmentFactory.newKeyValue(tag.value));
      }
      list.push(segmentFactory.newOperator(','));
      return list;
    }, []);
}

export function modelToString(tags, variablesHelper, options) {
  return tags.map(tag => {
    let value;
    if (tag.value === ' *') {
      // '*' character get a special treatment in grafana so we had to use ' *' instead
      value = '*';
    } else if (variablesHelper) {
      value = variablesHelper.resolve(tag.value, options).join('|');
    } else {
      value = tag.value;
    }
    return `${tag.name}:${value}`;
  }).join(',');
}
