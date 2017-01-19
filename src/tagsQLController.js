export class TagsQLController {

  constructor(uiSegmentSrv, datasource, $q, targetSupplier)  {
    this.uiSegmentSrv = uiSegmentSrv;
    this.datasource = datasource;
    this.$q = $q;
    this.targetSupplier = targetSupplier;
    this.removeTagsSegment = uiSegmentSrv.newSegment({fake: true, value: '-- Remove tag --'});
  }

  initTagsSegments() {
    var segments = [];
    for (let tag of this.targetSupplier().tags) {
      if (tag.condition) {
        segments.push(this.uiSegmentSrv.newCondition(tag.condition));
      }
      segments.push(this.uiSegmentSrv.newKey(tag.name));
      segments.push(this.uiSegmentSrv.newOperator(tag.operator));
      segments.push(this.uiSegmentSrv.newKeyValue(tag.value));
    }
    segments.push(this.uiSegmentSrv.newPlusButton());
    return segments;
  }

  getTagsSegments(segments, segment, $index) {
  }

  getTagKeys() {
    return this.datasource.suggestTagKeys()
      .then(this.uiSegmentSrv.transformToSegments(false));
  }

  tagsSegmentChanged(segments, segment, index) {
    this.saveInModel(segments);
  }

  saveInModel(segments) {
  }
}
