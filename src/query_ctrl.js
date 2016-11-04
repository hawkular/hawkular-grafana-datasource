import {QueryCtrl} from 'app/plugins/sdk';
import './css/query-editor.css!'

export class HawkularDatasourceQueryCtrl extends QueryCtrl {

  constructor($scope, $injector, uiSegmentSrv, $q)  {
    super($scope, $injector);

    this.scope = $scope;
    this.uiSegmentSrv = uiSegmentSrv;
    this.$q = $q;

    this.queryByTagCapability = false;
    this.statsPostCapability = false;
    this.datasource.getCapabilities().then(caps => {
      this.queryByTagCapability = caps.QUERY_BY_TAGS;
      this.statsPostCapability = caps.QUERY_STATS_POST_ENDPOINTS;
    });

    this.listQueryBy = [
      {value: 'ids', text: 'Search by name'},
      {value: 'tags', text: 'Search by tags'}
    ];
    this.metricTypes = [
      {value: 'gauge', text: 'Gauge'},
      {value: 'counter', text: 'Counter'},
      {value: 'availability', text: 'Availability'}
    ];
    this.seriesAggFns = [
      {value: 'none', text: 'None'},
      {value: 'sum', text: 'Sum'},
      {value: 'avg', text: 'Average'}
    ];
    this.timeAggFns = [
      {value: 'avg', text: 'Average'},
      {value: 'min', text: 'Min'},
      {value: 'max', text: 'Max'},
      {value: 'live', text: 'Live'}
    ];

    this.target.queryBy = this.target.queryBy || this.listQueryBy[0].value;
    this.target.type = this.target.type || this.metricTypes[0].value;
    this.target.target = this.target.target || 'select metric';
    this.target.rate = this.target.rate === true;
    this.target.tags = this.target.tags || [];
    this.target.seriesAggFn = this.target.seriesAggFn || this.seriesAggFns[0].value;
    this.target.timeAggFn = this.target.timeAggFn || this.timeAggFns[0].value;

    this.tagsSegments = _.reduce(this.target.tags, function(list, tag) {
      list.push(uiSegmentSrv.newKey(tag.name));
      list.push(uiSegmentSrv.newOperator(':'));
      list.push(uiSegmentSrv.newKeyValue(tag.value));
      list.push(uiSegmentSrv.newOperator(','));
      return list;
    }, []);
    this.tagsSegments.push(uiSegmentSrv.newPlusButton());
    this.removeTagsSegment = uiSegmentSrv.newSegment({fake: true, value: '-- Remove tag --'});
  }

  getTagsSegments(segment, $index) {
    if (segment.type === 'plus-button') {
      return this.$q.when([]);
    } else if (segment.type === 'key')  {
      return this.$q.when([angular.copy(this.removeTagsSegment)]);
    } else if (segment.type === 'value')  {
      var key = this.tagsSegments[$index-2].value;
      return this.datasource.suggestTags(this.target.type, key)
        .then(this.uiSegmentSrv.transformToSegments(false));
    }
  }

  tagsSegmentChanged(segment, index) {
    if (segment.value === this.removeTagsSegment.value) {
      this.tagsSegments.splice(index, 4);
    } else if (segment.type === 'plus-button') {
      this.tagsSegments.splice(index, 1, this.uiSegmentSrv.newOperator(','));
      this.tagsSegments.splice(index, 0, this.uiSegmentSrv.newKeyValue(' *'));
      this.tagsSegments.splice(index, 0, this.uiSegmentSrv.newOperator(':'));
      this.tagsSegments.splice(index, 0, this.uiSegmentSrv.newKey(segment.value));
      this.tagsSegments.push(this.uiSegmentSrv.newPlusButton());
    } else {
      this.tagsSegments[index] = segment;
    }
    this.tagsToModel();
    this.onChangeInternal();
  }

  tagsToModel() {
    this.target.tags = [];
    for (var i = 0; i < this.tagsSegments.length - 2; i += 4) {
      let key = this.tagsSegments[i].value;
      let val = this.tagsSegments[i+2].fake ? '*' : (this.tagsSegments[i+2].value || '*');
      this.target.tags.push({name: key, value: val});
    }
  }

  getOptions() {
    return this.datasource.suggestQueries(this.target)
      .then(this.uiSegmentSrv.transformToSegments(false));
      // Options have to be transformed by uiSegmentSrv to be usable by metric-segment-model directive
  }

  onChangeInternal() {
    if (this.target.type == 'availability') {
      // Disable multiple series aggregation
      this.target.seriesAggFn = this.seriesAggFns[0].value;
    }
    this.panelCtrl.refresh(); // Asks the panel to refresh data.
  }
}

HawkularDatasourceQueryCtrl.templateUrl = 'partials/query.editor.html';
