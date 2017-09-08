'use strict';

var _tagsKVPairsController = require('../tagsKVPairsController');

var _q = require('q');

var _q2 = _interopRequireDefault(_q);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

describe('TagsKVPairs', function () {

  var segmentFactory = {
    newSegment: function newSegment(arg) {
      return arg;
    },
    newKey: function newKey(key) {
      return { type: 'key', value: key };
    },
    newCondition: function newCondition(cond) {
      return { type: 'condition', value: cond };
    },
    newOperator: function newOperator(op) {
      return { type: 'operator', value: op };
    },
    newKeyValue: function newKeyValue(v) {
      return { type: 'value', value: v };
    }
  };

  it('should convert empty segments to empty model', function (done) {
    var result = (0, _tagsKVPairsController.segmentsToModel)([]);
    expect(result).to.deep.equal([]);
    done();
  });

  it('should convert segments to model', function (done) {
    var segments = [{ type: 'key', value: 'hostname' }, { type: 'operator', value: ':' }, { type: 'value', value: ' *' }, { type: 'operator', value: ',' }, { type: 'key', value: 'pod' }, { type: 'operator', value: ':' }, { type: 'value', value: 'unknown' }, { type: 'operator', value: ',' }];
    var result = (0, _tagsKVPairsController.segmentsToModel)(segments);
    expect(result).to.deep.equal([{ name: 'hostname', value: '*' }, { name: 'pod', value: 'unknown' }]);
    done();
  });

  it('should convert empty model to empty segments', function (done) {
    var result = (0, _tagsKVPairsController.modelToSegments)([], segmentFactory);
    expect(result).to.deep.equal([]);
    done();
  });

  it('should convert undefined model to empty segments', function (done) {
    var result = (0, _tagsKVPairsController.modelToSegments)(undefined, segmentFactory);
    expect(result).to.deep.equal([]);
    done();
  });

  it('should convert model to segments', function (done) {
    var result = (0, _tagsKVPairsController.modelToSegments)([{ name: 'hostname', value: '*' }, { name: 'pod', value: 'unknown' }], segmentFactory);
    expect(result).to.deep.equal([{ type: 'key', value: 'hostname' }, { type: 'operator', value: ':' }, { type: 'value', value: ' *' }, { type: 'operator', value: ',' }, { type: 'key', value: 'pod' }, { type: 'operator', value: ':' }, { type: 'value', value: 'unknown' }, { type: 'operator', value: ',' }]);
    done();
  });
});
//# sourceMappingURL=tags-kvpairs_spec.js.map
