'use strict';

System.register(['app/plugins/sdk', './css/query-editor.css!', './capabilities', './tagsKVPairsController', './tagsQLController'], function (_export, _context) {
  "use strict";

  var QueryCtrl, Capabilities, TagsKVPairsController, TagsQLController, _createClass, HawkularDatasourceQueryCtrl;

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  function _possibleConstructorReturn(self, call) {
    if (!self) {
      throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }

    return call && (typeof call === "object" || typeof call === "function") ? call : self;
  }

  function _inherits(subClass, superClass) {
    if (typeof superClass !== "function" && superClass !== null) {
      throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
    }

    subClass.prototype = Object.create(superClass && superClass.prototype, {
      constructor: {
        value: subClass,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
    if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
  }

  return {
    setters: [function (_appPluginsSdk) {
      QueryCtrl = _appPluginsSdk.QueryCtrl;
    }, function (_cssQueryEditorCss) {}, function (_capabilities) {
      Capabilities = _capabilities.Capabilities;
    }, function (_tagsKVPairsController) {
      TagsKVPairsController = _tagsKVPairsController.TagsKVPairsController;
    }, function (_tagsQLController) {
      TagsQLController = _tagsQLController.TagsQLController;
    }],
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

      _export('HawkularDatasourceQueryCtrl', HawkularDatasourceQueryCtrl = function (_QueryCtrl) {
        _inherits(HawkularDatasourceQueryCtrl, _QueryCtrl);

        function HawkularDatasourceQueryCtrl($scope, $injector, uiSegmentSrv, $q) {
          _classCallCheck(this, HawkularDatasourceQueryCtrl);

          var _this = _possibleConstructorReturn(this, (HawkularDatasourceQueryCtrl.__proto__ || Object.getPrototypeOf(HawkularDatasourceQueryCtrl)).call(this, $scope, $injector));

          _this.scope = $scope;
          _this.uiSegmentSrv = uiSegmentSrv;
          _this.$q = $q;

          _this.caps = new Capabilities("");
          _this.datasource.getCapabilities().then(function (caps) {
            _this.caps = caps;
            if (caps.TAGS_QUERY_LANGUAGE) {
              _this.tagsController = new TagsQLController(uiSegmentSrv, _this.datasource, $q, function () {
                return _this.target;
              });
            } else {
              _this.tagsController = new TagsKVPairsController(uiSegmentSrv, _this.datasource, $q, caps.FETCH_ALL_TAGS, function () {
                return _this.target;
              });
            }
            _this.tagsSegments = _this.tagsController.initTagsSegments();
          });

          _this.metricTypes = [{ value: 'gauge', text: 'Gauge' }, { value: 'counter', text: 'Counter' }, { value: 'availability', text: 'Availability' }];
          _this.seriesAggFns = [{ value: 'none', text: 'None' }, { value: 'sum', text: 'Sum' }, { value: 'avg', text: 'Average' }];
          _this.timeAggFns = [{ value: 'avg', text: 'Average' }, { value: 'min', text: 'Min' }, { value: 'max', text: 'Max' }, { value: 'live', text: 'Live' }];

          _this.target.type = _this.target.type || _this.metricTypes[0].value;
          // backward compatibility: check target.target
          _this.target.id = _this.target.id || _this.target.target || '-- none --';
          delete _this.target.target;
          _this.target.rate = _this.target.rate === true;
          _this.target.tags = _this.target.tags || [];
          _this.target.tagsQL = _this.target.tagsQL || "";
          _this.target.seriesAggFn = _this.target.seriesAggFn || _this.seriesAggFns[0].value;
          _this.target.timeAggFn = _this.target.timeAggFn || _this.timeAggFns[0].value;
          return _this;
        }

        _createClass(HawkularDatasourceQueryCtrl, [{
          key: 'getTagsSegments',
          value: function getTagsSegments(segment, $index) {
            return this.tagsController.getTagsSegments(this.tagsSegments, segment, $index);
          }
        }, {
          key: 'tagsSegmentChanged',
          value: function tagsSegmentChanged(segment, $index) {
            this.tagsController.tagsSegmentChanged(this.tagsSegments, segment, $index);
            this.onChangeInternal();
          }
        }, {
          key: 'getMetricOptions',
          value: function getMetricOptions() {
            return this.datasource.suggestQueries(this.target).then(function (metrics) {
              return [{ value: '-- none --', text: '-- none --' }].concat(metrics);
            }).then(this.uiSegmentSrv.transformToSegments(false));
            // Options have to be transformed by uiSegmentSrv to be usable by metric-segment-model directive
          }
        }, {
          key: 'onChangeInternal',
          value: function onChangeInternal() {
            if (this.target.type == 'availability') {
              // Disable multiple series aggregation
              this.target.seriesAggFn = this.seriesAggFns[0].value;
            }
            this.panelCtrl.refresh(); // Asks the panel to refresh data.
          }
        }, {
          key: 'toggleEditorMode',
          value: function toggleEditorMode() {
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
        }]);

        return HawkularDatasourceQueryCtrl;
      }(QueryCtrl));

      _export('HawkularDatasourceQueryCtrl', HawkularDatasourceQueryCtrl);

      HawkularDatasourceQueryCtrl.templateUrl = 'partials/query.editor.html';
    }
  };
});
//# sourceMappingURL=query_ctrl.js.map
