'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TagsKVPairsController = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

exports.segmentsToModel = segmentsToModel;
exports.modelToSegments = modelToSegments;
exports.modelToString = modelToString;

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var TagsKVPairsController = exports.TagsKVPairsController = function () {
  function TagsKVPairsController(uiSegmentSrv, datasource, $q, fetchAllTagsCapability, targetSupplier) {
    _classCallCheck(this, TagsKVPairsController);

    this.uiSegmentSrv = uiSegmentSrv;
    this.datasource = datasource;
    this.$q = $q;
    this.fetchAllTagsCapability = fetchAllTagsCapability;
    this.targetSupplier = targetSupplier;
    this.removeTagsSegment = uiSegmentSrv.newSegment({ fake: true, value: '-- Remove tag --' });
    this.modelToSegments = modelToSegments;
    this.segmentsToModel = segmentsToModel;
  }

  _createClass(TagsKVPairsController, [{
    key: 'initTagsSegments',
    value: function initTagsSegments() {
      var segments = modelToSegments(this.targetSupplier().tags, this.uiSegmentSrv);
      segments.push(this.uiSegmentSrv.newPlusButton());
      return segments;
    }
  }, {
    key: 'getTagsSegments',
    value: function getTagsSegments(segments, segment, $index) {
      var _this = this;

      if (segment.type === 'plus-button') {
        return this.getTagKeys();
      } else if (segment.type === 'key') {
        return this.getTagKeys().then(function (keys) {
          return [angular.copy(_this.removeTagsSegment)].concat(_toConsumableArray(keys));
        });
      } else if (segment.type === 'value') {
        var key = segments[$index - 2].value;
        return this.datasource.suggestTags(this.targetSupplier(), key).then(function (tags) {
          return [{ text: ' *', value: ' *' }].concat(_toConsumableArray(tags));
        }).then(this.uiSegmentSrv.transformToSegments(false));
      }
    }
  }, {
    key: 'getTagKeys',
    value: function getTagKeys() {
      if (this.fetchAllTagsCapability) {
        return this.datasource.suggestTagKeys(this.targetSupplier()).then(this.uiSegmentSrv.transformToSegments(false));
      } else {
        return this.$q.when([]);
      }
    }
  }, {
    key: 'tagsSegmentChanged',
    value: function tagsSegmentChanged(segments, segment, index) {
      if (segment.value === this.removeTagsSegment.value) {
        segments.splice(index, 4);
      } else if (segment.type === 'plus-button') {
        segments.splice(index, 1);
        segments.splice(index, 0, this.uiSegmentSrv.newKey(segment.value), this.uiSegmentSrv.newOperator(':'), this.uiSegmentSrv.newKeyValue(' *'), this.uiSegmentSrv.newOperator(','), this.uiSegmentSrv.newPlusButton());
      } else {
        segments[index] = segment;
      }
      this.targetSupplier().tags = segmentsToModel(segments);
    }
  }]);

  return TagsKVPairsController;
}();

function segmentsToModel(segments) {
  // or "serialize"
  var tags = [];
  for (var i = 0; i < segments.length - 2; i += 4) {
    var key = segments[i].value;
    var val = segments[i + 2].fake ? '*' : segments[i + 2].value;
    if (!val || val === ' *') {
      // '*' character get a special treatment in grafana so we had to use ' *' instead
      val = '*';
    }
    tags.push({ name: key, value: val });
  }
  return tags;
}

function modelToSegments(tags, segmentFactory) {
  // or "deserialize"
  return _lodash2.default.reduce(tags, function (list, tag) {
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

function modelToString(tags, variablesHelper, options) {
  return tags.map(function (tag) {
    var value = void 0;
    if (tag.value === ' *') {
      // '*' character get a special treatment in grafana so we had to use ' *' instead
      value = '*';
    } else if (variablesHelper) {
      value = variablesHelper.resolve(tag.value, options).join('|');
    } else {
      value = tag.value;
    }
    return tag.name + ':' + value;
  }).join(',');
}
//# sourceMappingURL=tagsKVPairsController.js.map
