'use strict';

var _tagsQLController = require('../tagsQLController');

var _q = require('q');

var _q2 = _interopRequireDefault(_q);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

describe('TagsQL', function () {

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

  it('should convert empty segments to empty string', function (done) {
    var result = (0, _tagsQLController.segmentsToString)([]);
    expect(result).to.deep.equal("");
    done();
  });

  it('should convert segments to string', function (done) {
    var segments = [{ type: 'key', value: 'hostname' }, { type: 'operator', value: 'exists' }, { type: 'condition', value: 'AND' }, { type: 'key', value: 'pod' }, { type: 'operator', value: '!=' }, { type: 'value', value: 'unknown' }];
    var result = (0, _tagsQLController.segmentsToString)(segments);
    expect(result).to.deep.equal("hostname AND pod!=unknown");
    done();
  });

  it('should convert segments with not exist to string', function (done) {
    var segments = [{ type: 'key', value: 'hostname' }, { type: 'operator', value: 'doesn\'t exist' }, { type: 'condition', value: 'AND' }, { type: 'key', value: 'pod' }, { type: 'operator', value: '!=' }, { type: 'value', value: 'unknown' }];
    var result = (0, _tagsQLController.segmentsToString)(segments);
    expect(result).to.deep.equal("NOT hostname AND pod!=unknown");
    done();
  });

  it('should convert empty string to empty segments', function (done) {
    var result = (0, _tagsQLController.stringToSegments)("", segmentFactory);
    expect(result).to.deep.equal([]);
    done();
  });

  it('should convert undefined string to empty segments', function (done) {
    var result = (0, _tagsQLController.stringToSegments)(undefined, segmentFactory);
    expect(result).to.deep.equal([]);
    done();
  });

  it('should convert string to segments allowing spaces everywhere', function (done) {
    var result = (0, _tagsQLController.stringToSegments)("  pod  !=  'unknown pod  '  ", segmentFactory);
    expect(result).to.deep.equal([{ type: 'key', value: 'pod' }, { type: 'operator', value: '!=' }, { type: 'value', value: "'unknown pod  '" }]);
    done();
  });

  it('should convert string to segments with single-quoted value having spaces', function (done) {
    var result = (0, _tagsQLController.stringToSegments)("NOT hostname AND pod!='unknown pod'", segmentFactory);
    expect(result).to.deep.equal([{ type: 'key', value: 'hostname' }, { type: 'operator', value: 'doesn\'t exist' }, { type: 'condition', value: 'AND' }, { type: 'key', value: 'pod' }, { type: 'operator', value: '!=' }, { type: 'value', value: "'unknown pod'" }]);
    done();
  });

  it('should convert string to segments with unquoted value', function (done) {
    var result = (0, _tagsQLController.stringToSegments)("pod != unknown AND hostname  ", segmentFactory);
    expect(result).to.deep.equal([{ type: 'key', value: 'pod' }, { type: 'operator', value: '!=' }, { type: 'value', value: 'unknown' }, { type: 'condition', value: 'AND' }, { type: 'key', value: 'hostname' }, { type: 'operator', value: 'exists' }]);
    done();
  });

  it('should convert string to segments with single value alone', function (done) {
    var result = (0, _tagsQLController.stringToSegments)("hostname", segmentFactory);
    expect(result).to.deep.equal([{ type: 'key', value: 'hostname' }, { type: 'operator', value: 'exists' }]);
    done();
  });

  it('should convert string to segments with no space around equal', function (done) {
    var result = (0, _tagsQLController.stringToSegments)("pod=unknown", segmentFactory);
    expect(result).to.deep.equal([{ type: 'key', value: 'pod' }, { type: 'operator', value: '=' }, { type: 'value', value: 'unknown' }]);
    done();
  });

  it('should convert string to segments with no space around not equal', function (done) {
    var result = (0, _tagsQLController.stringToSegments)("pod!=unknown", segmentFactory);
    expect(result).to.deep.equal([{ type: 'key', value: 'pod' }, { type: 'operator', value: '!=' }, { type: 'value', value: 'unknown' }]);
    done();
  });

  it('should convert segment with enumeration to string', function (done) {
    var segments = [{ type: 'key', value: 'hostname' }, { type: 'operator', value: 'exists' }, { type: 'condition', value: 'AND' }, { type: 'key', value: 'pod' }, { type: 'operator', value: 'is not in' }, { type: 'value', value: 'abc' }, { type: 'value', value: 'def' }];
    var result = (0, _tagsQLController.segmentsToString)(segments);
    expect(result).to.deep.equal("hostname AND pod NOT IN [abc,def]");
    done();
  });

  it('should convert segment with enumeration and plus button to string', function (done) {
    var segments = [{ type: 'key', value: 'hostname' }, { type: 'operator', value: 'is in' }, { type: 'value', value: 'alpha' }, { type: 'value', value: 'beta' }, { type: 'plus-button', value: '' }, { type: 'condition', value: 'AND' }, { type: 'key', value: 'pod' }, { type: 'operator', value: 'is not in' }, { type: 'value', value: 'abc' }, { type: 'value', value: 'def' }, { type: 'plus-button', value: '' }, { type: 'plus-button', value: '' }];
    var result = (0, _tagsQLController.segmentsToString)(segments);
    expect(result).to.deep.equal("hostname IN [alpha,beta] AND pod NOT IN [abc,def]");
    done();
  });

  it('should convert segment with enumeration with single quotes to string', function (done) {
    var segments = [{ type: 'key', value: 'pod' }, { type: 'operator', value: 'is in' }, { type: 'value', value: "'a b c'" }];
    var result = (0, _tagsQLController.segmentsToString)(segments);
    expect(result).to.deep.equal("pod IN ['a b c']");
    done();
  });

  it('should use quotes when non-alphadecimal characters are found except for variables', function (done) {
    var segments = [{ type: 'key', value: 'pod' }, { type: 'operator', value: 'is in' }, { type: 'value', value: "a b c" }, { type: 'value', value: "def" }, { type: 'value', value: "+33/10" }, { type: 'value', value: "$variable" }];
    var result = (0, _tagsQLController.segmentsToString)(segments);
    expect(result).to.deep.equal("pod IN ['a b c',def,'+33/10',$variable]");
    done();
  });

  it('should accept usual alphadecimal variable name', function (done) {
    var segments = [{ type: 'key', value: 'pod_id' }, { type: 'operator', value: 'is in' }, { type: 'value', value: "$var_iable_01234" }];
    var result = (0, _tagsQLController.segmentsToString)(segments);
    expect(result).to.deep.equal("pod_id IN [$var_iable_01234]");
    done();
  });

  it('should accept usual alphadecimal variable name in back conversion', function (done) {
    var result = (0, _tagsQLController.stringToSegments)("pod_id NOT IN [$var_iable_01234]", segmentFactory);
    expect(result).to.deep.equal([{ type: 'key', value: 'pod_id' }, { type: 'operator', value: 'is not in' }, { type: 'value', value: "$var_iable_01234" }]);
    done();
  });

  it('should accept dot in variable name', function (done) {
    var segments = [{ type: 'key', value: 'pod.id' }, { type: 'operator', value: 'is in' }, { type: 'value', value: "$var_iable_01234" }];
    var result = (0, _tagsQLController.segmentsToString)(segments);
    expect(result).to.deep.equal("pod.id IN [$var_iable_01234]");
    done();
  });

  it('should accept dot in variable name for back conversion', function (done) {
    var result = (0, _tagsQLController.stringToSegments)("pod.id NOT IN [$var_iable_01234]", segmentFactory);
    expect(result).to.deep.equal([{ type: 'key', value: 'pod.id' }, { type: 'operator', value: 'is not in' }, { type: 'value', value: "$var_iable_01234" }]);
    done();
  });

  it('should convert string with enumeration to segments', function (done) {
    var result = (0, _tagsQLController.stringToSegments)("hostname AND pod NOT IN ['abc','def']", segmentFactory);
    expect(result).to.deep.equal([{ type: 'key', value: 'hostname' }, { type: 'operator', value: 'exists' }, { type: 'condition', value: 'AND' }, { type: 'key', value: 'pod' }, { type: 'operator', value: 'is not in' }, { type: 'value', value: "'abc'" }, { type: 'value', value: "'def'" }]);
    done();
  });

  it('should convert segment with enumeration only to string', function (done) {
    var segments = [{ type: 'key', value: 'pod' }, { type: 'operator', value: 'is in' }, { type: 'value', value: 'abc' }, { type: 'value', value: 'def' }];
    var result = (0, _tagsQLController.segmentsToString)(segments);
    expect(result).to.deep.equal("pod IN [abc,def]");
    done();
  });

  it('should convert string with enumeration only with quotes and spaces to segments', function (done) {
    var result = (0, _tagsQLController.stringToSegments)("  pod  IN [  'abc' ,  'def ghi'  ]  ", segmentFactory);
    expect(result).to.deep.equal([{ type: 'key', value: 'pod' }, { type: 'operator', value: 'is in' }, { type: 'value', value: "'abc'" }, { type: 'value', value: "'def ghi'" }]);
    done();
  });

  it('should convert from key-value pairs', function (done) {
    var result = (0, _tagsQLController.convertFromKVPairs)([{ name: "hostname", value: "*" }, { name: "app", value: "aloha" }, { name: "pod", value: "unknown" }]);
    expect(result).to.deep.equal("hostname AND app='aloha' AND pod='unknown'");
    done();
  });

  it('should convert from key-value pairs with variable', function (done) {
    var result = (0, _tagsQLController.convertFromKVPairs)([{ name: "hostname", value: "*" }, { name: "app", value: "$app" }]);
    expect(result).to.deep.equal("hostname AND app IN [$app]");
    done();
  });
});
//# sourceMappingURL=tags-ql_spec.js.map
