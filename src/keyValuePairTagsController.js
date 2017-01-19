export class KeyValuePairTagsController {

  constructor(uiSegmentSrv, datasource, $q, fetchAllTagsCapability, targetSupplier)  {
    this.uiSegmentSrv = uiSegmentSrv;
    this.datasource = datasource;
    this.$q = $q;
    this.fetchAllTagsCapability = fetchAllTagsCapability;
    this.targetSupplier = targetSupplier;
    this.removeTagsSegment = uiSegmentSrv.newSegment({fake: true, value: '-- Remove tag --'});
  }

  initTagsSegments() {
    let uiSegmentSrv = this.uiSegmentSrv;
    var segments = _.reduce(this.targetSupplier().tags, function(list, tag) {
      list.push(uiSegmentSrv.newKey(tag.name));
      list.push(uiSegmentSrv.newOperator(':'));
      list.push(uiSegmentSrv.newKeyValue(tag.value));
      list.push(uiSegmentSrv.newOperator(','));
      return list;
    }, []);
    segments.push(uiSegmentSrv.newPlusButton());
    return segments;
  }

  getTagsSegments(segments, segment, $index) {
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
    if (this.fetchAllTagsCapability) {
      return this.datasource.suggestTagKeys()
        .then(this.uiSegmentSrv.transformToSegments(false));
    } else {
      return this.$q.when([]);
    }
  }

  tagsSegmentChanged(segments, segment, index) {
    if (segment.value === this.removeTagsSegment.value) {
      segments.splice(index, 4);
    } else if (segment.type === 'plus-button') {
      segments.splice(index, 1, this.uiSegmentSrv.newOperator(','));
      segments.splice(index, 0, this.uiSegmentSrv.newKeyValue(' *'));
      segments.splice(index, 0, this.uiSegmentSrv.newOperator(':'));
      segments.splice(index, 0, this.uiSegmentSrv.newKey(segment.value));
      segments.push(this.uiSegmentSrv.newPlusButton());
    } else {
      segments[index] = segment;
    }
    this.saveInModel(segments);
  }

  saveInModel(segments) {
    let target = this.targetSupplier();
    target.tags = [];
    for (var i = 0; i < segments.length - 2; i += 4) {
      let key = segments[i].value;
      let val = segments[i+2].fake ? '*' : (segments[i+2].value || '*');
      target.tags.push({name: key, value: val});
    }
  }
}
