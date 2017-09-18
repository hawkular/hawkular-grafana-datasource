# Building a development Docker image

1. Build the plugin from repository root:

```bash
grunt
```

2. Move (or copy) the `dist` directory to `docker/` and `cd` to it.

```bash
mv dist docker && cd docker
```

3. Build the docker image from Dockerfile.dev

```bash
docker build -f Dockerfile.dev -t hawkular/hawkular-grafana-datasource:dev-build .
```

4. Test the image

```bash
docker run -i -p 3000:3000 --name hawkular-grafana-datasource --rm hawkular/hawkular-grafana-datasource:dev-build
```

And login on http://localhost:3000/
