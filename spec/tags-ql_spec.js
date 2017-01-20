import {segmentsToString, stringToSegments, convertFromKVPairs} from '../tagsQLController';
import Q from "q";

describe('TagsQL', function() {

  let newSegment = props => {
    // console.log("Adding segment: " + props.type + ", " + props.value);
    return props;
  };
  let segmentFactory = {
    newSegment: newSegment,
    newKey: key => newSegment({type: 'key', value: key}),
    newCondition: cond => newSegment({type: 'condition', value: cond}),
    newOperator: op => newSegment({type: 'operator', value: op}),
    newKeyValue: v => newSegment({type: 'value', value: v})
  };

  it('should convert empty segments to empty string', function(done) {
    let result = segmentsToString([]);
    expect(result).to.deep.equal("");
    done();
  });

  it('should convert segments to string', function(done) {
    let segments = [
      { type: 'key', value: 'hostname' },
      { type: 'operator', value: 'EXISTS' },
      { type: 'condition', value: 'AND' },
      { type: 'key', value: 'pod' },
      { type: 'operator', value: '!=' },
      { type: 'value', value: 'unknown' }
    ];
    let result = segmentsToString(segments);
    expect(result).to.deep.equal("hostname EXISTS AND pod != 'unknown'");
    done();
  });

  it('should convert empty string to empty segments', function(done) {
    let result = stringToSegments("", segmentFactory);
    expect(result).to.deep.equal([]);
    done();
  });

  it('should convert undefined string to empty segments', function(done) {
    let result = stringToSegments(undefined, segmentFactory);
    expect(result).to.deep.equal([]);
    done();
  });

  it('should convert string to segments allowing spaces everywhere', function(done) {
    let result = stringToSegments("  pod  !=  'unknown pod  '  ", segmentFactory);
    expect(result).to.deep.equal([
      { type: 'key', value: 'pod' },
      { type: 'operator', value: '!=' },
      { type: 'value', value: 'unknown pod  ' }
    ]);
    done();
  });

  it('should convert string to segments with single-quoted value having spaces', function(done) {
    let result = stringToSegments("hostname EXISTS AND pod != 'unknown pod'", segmentFactory);
    expect(result).to.deep.equal([
      { type: 'key', value: 'hostname' },
      { type: 'operator', value: 'EXISTS' },
      { type: 'condition', value: 'AND' },
      { type: 'key', value: 'pod' },
      { type: 'operator', value: '!=' },
      { type: 'value', value: 'unknown pod' }
    ]);
    done();
  });

  it('should convert string to segments with double-quoted value having spaces', function(done) {
    let result = stringToSegments('hostname NOT EXISTS OR pod = "unknown pod"', segmentFactory);
    expect(result).to.deep.equal([
      { type: 'key', value: 'hostname' },
      { type: 'operator', value: 'NOT EXISTS' },
      { type: 'condition', value: 'OR' },
      { type: 'key', value: 'pod' },
      { type: 'operator', value: '=' },
      { type: 'value', value: 'unknown pod' }
    ]);
    done();
  });

  it('should convert string to segments with unquoted value', function(done) {
    let result = stringToSegments("pod != unknown AND hostname EXISTS", segmentFactory);
    expect(result).to.deep.equal([
      { type: 'key', value: 'pod' },
      { type: 'operator', value: '!=' },
      { type: 'value', value: 'unknown' },
      { type: 'condition', value: 'AND' },
      { type: 'key', value: 'hostname' },
      { type: 'operator', value: 'EXISTS' }
    ]);
    done();
  });

  it('should convert string to segments with no space around equal', function(done) {
    let result = stringToSegments("pod=unknown", segmentFactory);
    expect(result).to.deep.equal([
      { type: 'key', value: 'pod' },
      { type: 'operator', value: '=' },
      { type: 'value', value: 'unknown' }
    ]);
    done();
  });

  it('should convert string to segments with no space around not equal', function(done) {
    let result = stringToSegments("pod!=unknown", segmentFactory);
    expect(result).to.deep.equal([
      { type: 'key', value: 'pod' },
      { type: 'operator', value: '!=' },
      { type: 'value', value: 'unknown' }
    ]);
    done();
  });

  it('should convert segment with enumeration to string', function(done) {
    let segments = [
      { type: 'key', value: 'hostname' },
      { type: 'operator', value: 'EXISTS' },
      { type: 'condition', value: 'AND' },
      { type: 'key', value: 'pod' },
      { type: 'operator', value: 'NOT IN' },
      { type: 'value', value: 'abc' },
      { type: 'value', value: 'def' }
    ];
    let result = segmentsToString(segments);
    expect(result).to.deep.equal("hostname EXISTS AND pod NOT IN ['abc','def']");
    done();
  });

  it('should convert string with enumeration to segments', function(done) {
    let result = stringToSegments("hostname EXISTS AND pod NOT IN ['abc','def']", segmentFactory);
    expect(result).to.deep.equal([
      { type: 'key', value: 'hostname' },
      { type: 'operator', value: 'EXISTS' },
      { type: 'condition', value: 'AND' },
      { type: 'key', value: 'pod' },
      { type: 'operator', value: 'NOT IN' },
      { type: 'value', value: 'abc' },
      { type: 'value', value: 'def' }
    ]);
    done();
  });

  it('should convert segment with enumeration only to string', function(done) {
    let segments = [
      { type: 'key', value: 'pod' },
      { type: 'operator', value: 'IN' },
      { type: 'value', value: 'abc' },
      { type: 'value', value: 'def' }
    ];
    let result = segmentsToString(segments);
    expect(result).to.deep.equal("pod IN ['abc','def']");
    done();
  });

  it('should convert string with enumeration only with double quotes and spaces to segments', function(done) {
    let result = stringToSegments('  pod  IN [  "abc",  "def ghi"  ]  ', segmentFactory);
    expect(result).to.deep.equal([
      { type: 'key', value: 'pod' },
      { type: 'operator', value: 'IN' },
      { type: 'value', value: 'abc' },
      { type: 'value', value: 'def ghi' }
    ]);
    done();
  });

  it('should convert from key-value pairs', function(done) {
    let result = convertFromKVPairs([
      { name: "hostname", value: "*" },
      { name: "app", value: "aloha" },
      { name: "pod", value: "unknown" }
    ]);
    expect(result).to.deep.equal("hostname EXISTS AND app='aloha' AND pod='unknown'");
    done();
  });
});
