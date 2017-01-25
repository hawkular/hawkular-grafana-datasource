import {QueryCtrl} from 'app/plugins/sdk';
import './css/query-editor.css!'
import {Capabilities} from './capabilities';
import {TagsKVPairsController} from './tagsKVPairsController';
import {TagsQLController} from './tagsQLController';

export class HawkularDatasourceQueryCtrl extends QueryCtrl {

  constructor($scope, $injector, uiSegmentSrv, $q)  {
    super($scope, $injector);

    this.scope = $scope;
    this.uiSegmentSrv = uiSegmentSrv;
    this.$q = $q;

    let self = this;
    this.caps = new Capabilities("");
    this.datasource.getCapabilities().then(caps => {
      self.caps = caps;
      if (caps.TAGS_QUERY_LANGUAGE) {
        self.tagsController = new TagsQLController(uiSegmentSrv, self.datasource, $q, function() { return self.target; });
      } else {
        self.tagsController = new TagsKVPairsController(uiSegmentSrv, self.datasource, $q, caps.FETCH_ALL_TAGS, function() { return self.target; });
      }
      self.tagsSegments = self.tagsController.initTagsSegments();
    });

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

    this.target.type = this.target.type || this.metricTypes[0].value;
    this.target.id = this.target.id || '-- none --';
    this.target.rate = this.target.rate === true;
    this.target.tags = this.target.tags || [];
    this.target.tagsQL = this.target.tagsQL || "";
    this.target.seriesAggFn = this.target.seriesAggFn || this.seriesAggFns[0].value;
    this.target.timeAggFn = this.target.timeAggFn || this.timeAggFns[0].value;
  }

  getTagsSegments(segment, $index) {
    return this.tagsController.getTagsSegments(this.tagsSegments, segment, $index);
  }

  tagsSegmentChanged(segment, $index) {
    this.tagsController.tagsSegmentChanged(this.tagsSegments, segment, $index);
    this.onChangeInternal();
  }

  getMetricOptions() {
    return this.datasource.suggestQueries(this.target)
      .then(metrics => [{value: '-- none --', text: '-- none --'}].concat(metrics))
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

  toggleEditorMode() {
    if (this.caps.TAGS_QUERY_LANGUAGE) {
      this.target.rawTagsQuery = !this.target.rawTagsQuery;
      if (!this.target.rawTagsQuery) {
        try {
          this.tagsSegments = this.tagsController.initTagsSegments();
        } catch (err) {
          this.target.rawTagsQuery = true;
          console.log('Cannot parse query: ' + err);
        }
      }
    } else {
      this.target.rawTagsQuery = false;
    }
  }
}

HawkularDatasourceQueryCtrl.templateUrl = 'partials/query.editor.html';
