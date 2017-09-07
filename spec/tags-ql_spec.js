import {segmentsToString, stringToSegments, convertFromKVPairs} from '../tagsQLController';
import Q from "q";

describe('TagsQL', () => {

  const segmentFactory = {
    newSegment: arg => arg,
    newKey: key => ({type: 'key', value: key}),
    newCondition: cond => ({type: 'condition', value: cond}),
    newOperator: op => ({type: 'operator', value: op}),
    newKeyValue: v => ({type: 'value', value: v})
  };

  it('should convert empty segments to empty string', done => {
    const result = segmentsToString([]);
    expect(result).to.deep.equal("");
    done();
  });

  it('should convert segments to string', done => {
    const segments = [
      { type: 'key', value: 'hostname' },
      { type: 'operator', value: 'exists' },
      { type: 'condition', value: 'AND' },
      { type: 'key', value: 'pod' },
      { type: 'operator', value: '!=' },
      { type: 'value', value: 'unknown' }
    ];
    const result = segmentsToString(segments);
    expect(result).to.deep.equal("hostname AND pod!=unknown");
    done();
  });

  it('should convert segments with not exist to string', done => {
    const segments = [
      { type: 'key', value: 'hostname' },
      { type: 'operator', value: 'doesn\'t exist' },
      { type: 'condition', value: 'AND' },
      { type: 'key', value: 'pod' },
      { type: 'operator', value: '!=' },
      { type: 'value', value: 'unknown' }
    ];
    const result = segmentsToString(segments);
    expect(result).to.deep.equal("NOT hostname AND pod!=unknown");
    done();
  });

  it('should convert empty string to empty segments', done => {
    const result = stringToSegments("", segmentFactory);
    expect(result).to.deep.equal([]);
    done();
  });

  it('should convert undefined string to empty segments', done => {
    const result = stringToSegments(undefined, segmentFactory);
    expect(result).to.deep.equal([]);
    done();
  });

  it('should convert string to segments allowing spaces everywhere', done => {
    const result = stringToSegments("  pod  !=  'unknown pod  '  ", segmentFactory);
    expect(result).to.deep.equal([
      { type: 'key', value: 'pod' },
      { type: 'operator', value: '!=' },
      { type: 'value', value: "'unknown pod  '" }
    ]);
    done();
  });

  it('should convert string to segments with single-quoted value having spaces', done => {
    const result = stringToSegments("NOT hostname AND pod!='unknown pod'", segmentFactory);
    expect(result).to.deep.equal([
      { type: 'key', value: 'hostname' },
      { type: 'operator', value: 'doesn\'t exist' },
      { type: 'condition', value: 'AND' },
      { type: 'key', value: 'pod' },
      { type: 'operator', value: '!=' },
      { type: 'value', value: "'unknown pod'" }
    ]);
    done();
  });

  it('should convert string to segments with unquoted value', done => {
    const result = stringToSegments("pod != unknown AND hostname  ", segmentFactory);
    expect(result).to.deep.equal([
      { type: 'key', value: 'pod' },
      { type: 'operator', value: '!=' },
      { type: 'value', value: 'unknown' },
      { type: 'condition', value: 'AND' },
      { type: 'key', value: 'hostname' },
      { type: 'operator', value: 'exists' }
    ]);
    done();
  });

  it('should convert string to segments with single value alone', done => {
    const result = stringToSegments("hostname", segmentFactory);
    expect(result).to.deep.equal([
      { type: 'key', value: 'hostname' },
      { type: 'operator', value: 'exists' }
    ]);
    done();
  });

  it('should convert string to segments with no space around equal', done => {
    const result = stringToSegments("pod=unknown", segmentFactory);
    expect(result).to.deep.equal([
      { type: 'key', value: 'pod' },
      { type: 'operator', value: '=' },
      { type: 'value', value: 'unknown' }
    ]);
    done();
  });

  it('should convert string to segments with no space around not equal', done => {
    const result = stringToSegments("pod!=unknown", segmentFactory);
    expect(result).to.deep.equal([
      { type: 'key', value: 'pod' },
      { type: 'operator', value: '!=' },
      { type: 'value', value: 'unknown' }
    ]);
    done();
  });

  it('should convert segment with enumeration to string', done => {
    const segments = [
      { type: 'key', value: 'hostname' },
      { type: 'operator', value: 'exists' },
      { type: 'condition', value: 'AND' },
      { type: 'key', value: 'pod' },
      { type: 'operator', value: 'is not in' },
      { type: 'value', value: 'abc' },
      { type: 'value', value: 'def' }
    ];
    const result = segmentsToString(segments);
    expect(result).to.deep.equal("hostname AND pod NOT IN [abc,def]");
    done();
  });

  it('should convert segment with enumeration and plus button to string', done => {
    const segments = [
      { type: 'key', value: 'hostname' },
      { type: 'operator', value: 'is in' },
      { type: 'value', value: 'alpha' },
      { type: 'value', value: 'beta' },
      { type: 'plus-button', value: '' },
      { type: 'condition', value: 'AND' },
      { type: 'key', value: 'pod' },
      { type: 'operator', value: 'is not in' },
      { type: 'value', value: 'abc' },
      { type: 'value', value: 'def' },
      { type: 'plus-button', value: '' },
      { type: 'plus-button', value: '' }
    ];
    const result = segmentsToString(segments);
    expect(result).to.deep.equal("hostname IN [alpha,beta] AND pod NOT IN [abc,def]");
    done();
  });

  it('should convert segment with enumeration with single quotes to string', done => {
    const segments = [
      { type: 'key', value: 'pod' },
      { type: 'operator', value: 'is in' },
      { type: 'value', value: "'a b c'" }
    ];
    const result = segmentsToString(segments);
    expect(result).to.deep.equal("pod IN ['a b c']");
    done();
  });

  it('should use quotes when non-alphadecimal characters are found except for variables', done => {
    const segments = [
      { type: 'key', value: 'pod' },
      { type: 'operator', value: 'is in' },
      { type: 'value', value: "a b c" },
      { type: 'value', value: "def" },
      { type: 'value', value: "+33/10" },
      { type: 'value', value: "$variable" }
    ];
    const result = segmentsToString(segments);
    expect(result).to.deep.equal("pod IN ['a b c',def,'+33/10',$variable]");
    done();
  });

  it('should accept usual alphadecimal variable name', done => {
    const segments = [
      { type: 'key', value: 'pod_id' },
      { type: 'operator', value: 'is in' },
      { type: 'value', value: "$var_iable_01234" }
    ];
    const result = segmentsToString(segments);
    expect(result).to.deep.equal("pod_id IN [$var_iable_01234]");
    done();
  });

  it('should accept usual alphadecimal variable name in back conversion', done => {
    const result = stringToSegments("pod_id NOT IN [$var_iable_01234]", segmentFactory);
    expect(result).to.deep.equal([
      { type: 'key', value: 'pod_id' },
      { type: 'operator', value: 'is not in' },
      { type: 'value', value: "$var_iable_01234" }
    ]);
    done();
  });

  it('should accept dot in variable name', done => {
    const segments = [
      { type: 'key', value: 'pod.id' },
      { type: 'operator', value: 'is in' },
      { type: 'value', value: "$var_iable_01234" }
    ];
    const result = segmentsToString(segments);
    expect(result).to.deep.equal("pod.id IN [$var_iable_01234]");
    done();
  });

  it('should accept dot in variable name for back conversion', done => {
    const result = stringToSegments("pod.id NOT IN [$var_iable_01234]", segmentFactory);
    expect(result).to.deep.equal([
      { type: 'key', value: 'pod.id' },
      { type: 'operator', value: 'is not in' },
      { type: 'value', value: "$var_iable_01234" }
    ]);
    done();
  });

  it('should convert string with enumeration to segments', done => {
    const result = stringToSegments("hostname AND pod NOT IN ['abc','def']", segmentFactory);
    expect(result).to.deep.equal([
      { type: 'key', value: 'hostname' },
      { type: 'operator', value: 'exists' },
      { type: 'condition', value: 'AND' },
      { type: 'key', value: 'pod' },
      { type: 'operator', value: 'is not in' },
      { type: 'value', value: "'abc'" },
      { type: 'value', value: "'def'" }
    ]);
    done();
  });

  it('should convert segment with enumeration only to string', done => {
    const segments = [
      { type: 'key', value: 'pod' },
      { type: 'operator', value: 'is in' },
      { type: 'value', value: 'abc' },
      { type: 'value', value: 'def' }
    ];
    const result = segmentsToString(segments);
    expect(result).to.deep.equal("pod IN [abc,def]");
    done();
  });

  it('should convert string with enumeration only with quotes and spaces to segments', done => {
    const result = stringToSegments("  pod  IN [  'abc' ,  'def ghi'  ]  ", segmentFactory);
    expect(result).to.deep.equal([
      { type: 'key', value: 'pod' },
      { type: 'operator', value: 'is in' },
      { type: 'value', value: "'abc'" },
      { type: 'value', value: "'def ghi'" }
    ]);
    done();
  });

  it('should convert from key-value pairs', done => {
    const result = convertFromKVPairs([
      { name: "hostname", value: "*" },
      { name: "app", value: "aloha" },
      { name: "pod", value: "unknown" }
    ]);
    expect(result).to.deep.equal("hostname AND app='aloha' AND pod='unknown'");
    done();
  });

  it('should convert from key-value pairs with variable', done => {
    const result = convertFromKVPairs([
      { name: "hostname", value: "*" },
      { name: "app", value: "$app" }
    ]);
    expect(result).to.deep.equal("hostname AND app IN [$app]");
    done();
  });
});
