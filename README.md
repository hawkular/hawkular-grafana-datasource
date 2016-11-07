# Hawkular Datasource for Grafana

This project is the Hawkular Datasource plugin for Grafana 3. It works with:

* Metrics standalone servers as well
* Hawkular servers, starting from version Alpha13

## Configuration

The datasource URL must point to the Hawkular Metrics service, e.g. `http://myhost:8080/hawkular/metrics`

`direct` access mode only works with standalone Metrics servers currently. If you active it, make sure to allow
the Grafana server origin in Metrics' configuration.

Authentication must be set when working with a Hawkular server. Check the 'Basic Auth' box and fill the user and password fields.

Select the tenant. On Hawkular servers, use `hawkular`.

Openshift-Metrics users must provide an authentication token.

## Usage

### Queries

When adding a Graph panel, the Metrics tab allows you fetch _Gauges_, _Counters_ and _Availability_ metrics in Hawkular. You can either search by metric id or by tag.

When searching by id, you must provide the exact metric id (or use variables, as discussed later).

![Example of query by name](https://raw.githubusercontent.com/hawkular/hawkular-grafana-datasource/master/docs/images/search-by-name.png)

When searching by tag, you must provide the tag key, followed by its value or any pattern recognized by Hawkular Metrics. Check how [tagging works in Hawkular](http://www.hawkular.org/hawkular-metrics/docs/user-guide/#_tag_filtering).

- To add more tag filters, hit the "+" button and repeat the process.
- To remove a tag, click on its key and select "Remove tag".

![Example of query by tag](https://raw.githubusercontent.com/hawkular/hawkular-grafana-datasource/master/docs/images/search-by-tag.png)

> Note that querying by tag may return multiple series for a single query, as illustrated above.

When using a _Singlestat_ panel, some additional options come in. The Hawkular Datasource plugin can perform aggregations on multiple metrics, which usually the _Singlestat_ panel doesn't. It's actually a two-steps aggregation: first, multiple series are reduced into a single one (that is either the sum of its parts, or the average). Then, the resulting series is aggregated over time through another folding: min, max, average etc.

![Example of singlestat panel](https://raw.githubusercontent.com/hawkular/hawkular-grafana-datasource/master/docs/images/single-stats-aggreg.png)

> Note that because the aggregation takes place in Hawkular, the _Singlestat_ panel has nothing to aggregate. Thus in panel options, setting whatever in the _value_ field on the _Big value_ won't have any effect. However if you don't want to use the Hawkular aggregation, just set _Multiple series aggregation_ to _None_.

### Templating variables

Grafana allows you to create dashboard templates through the definition of variables.
This is [documented on Grafana's site](http://docs.grafana.org/reference/templating/).
With the Hawkular Datasource Plugin, the variables of type _'Query'_ are mapped to
the [_@get (url)/metrics_](http://www.hawkular.org/docs/rest/rest-metrics.html#GET__metrics)
Hawkular Metrics endpoint and can be used to retrieve tenant's metric names. Use the _Query Options_ text field to pass query parameters, as illustrated below:

Example of query by tags to get metric ids
![Example of query by tags to get metric ids](https://raw.githubusercontent.com/hawkular/hawkular-grafana-datasource/master/docs/images/query-for-metrics.png)

> For instance, if you have metrics tagged _"type:memory"_ and others tagged _"type:cpu"_, you can write _"tags=type:memory"_ to get only the _"memory"_ ones, or _"tags=type:cpu|memory"_ to get them both.

There is an exception to that rule: if the query string is prefixed with _'tags/'_, the variable will contain the matching
tag names rather than the metric names. In this case, the Hawkular Metrics endpoint [_@get (url)/metrics/tags/{tags}_](http://www.hawkular.org/docs/rest/rest-metrics.html#GET__metrics_tags__tags) will be used.

Example of query to get matching tag values
![example to get matching tag values](https://raw.githubusercontent.com/hawkular/hawkular-grafana-datasource/master/docs/images/query-for-tags.png)

> For instance, type _"tags/type:*"_ to get all of the available tag values for _"type"_.

Once you have set some variables, you can use them in graph queries: either for row or graph duplication, or to display multiple series in a single graph from a single query. This is especially useful when metric names contain some dynamic parts and thus cannot be known in advance.

## Installing from sources

Additional information on installing from sources can be found on [hawkular.org](http://www.hawkular.org/hawkular-clients/grafana/docs/quickstart-guide/).
