

function initVotesMap() {
var svg = d3.select("#neighborhood-bottom svg"),
  width = +svg.attr("width"),
  height = +svg.attr("height");
 
var projection = d3.geoMercator();

// Data and color scale
var colorScale = d3.scaleThreshold()
  .domain([50, 100, 150, 200, 250, 300])
  .range(d3.schemePuRd[7]);

d3.json("data/votes-by-neighborhoods.geojson").then(function(topo) {


  projection.fitSize([width, height], topo);

  var path = d3.geoPath().projection(projection);

  var data = new Map(topo.features.map(function(d) {
    return [d.properties.name, +d.properties.votes];
  }));

  var mapGroup = svg.select(".map");

  mapGroup.selectAll("path")
    .data(topo.features)
    .enter()
    .append("path")

      .attr("d", path)

      .attr("fill", function (d) {
        d.total = data.get(d.properties.name) || 0;
        return colorScale(d.total);
      })
      .attr("stroke", "transparent")
      .attr("stroke-width", 1);

  // Labels for the top 3 neighborhoods by vote count
  var top3 = topo.features
    .slice()
    .sort(function (a, b) { return +b.properties.votes - +a.properties.votes; })
    .slice(0, 3);

  mapGroup.selectAll("text.neighborhood-label")
    .data(top3)
    .enter()
    .append("text")
      .attr("class", "neighborhood-label")
      .attr("x", function (d) { return path.centroid(d)[0]; })
      .attr("y", function (d) { return path.centroid(d)[1]; })
      .attr("text-anchor", "middle")
      .attr("font-size", "15px")
      .attr("font-weight", "bold")
      .attr("fill", "white")
      .attr("stroke", "black")
      .attr("stroke-width", "0.45px")
      .attr("paint-order", "stroke")
      .text(function (d) { return d.properties.name; });

  // Continuous legend with breakpoints - horizontal bar along the bottom
  var domainBreaks = colorScale.domain(); // [50, 100, 150, 200, 250, 300]
  var colors = colorScale.range();
  var step = domainBreaks[1] - domainBreaks[0];
  var boundaries = [0].concat(domainBreaks, [domainBreaks[domainBreaks.length - 1] + step]);

  var legendWidth = Math.min(220, width - 20);
  var legendHeight = 20;

  var legendScale = d3.scaleLinear()
    .domain([boundaries[0], boundaries[boundaries.length - 1]])
    .range([0, legendWidth]);

  var legend = svg.append("g")
    .attr("class", "legend")
    .attr("font-family", "var(--body-font)")
    .attr("transform", "translate(" + (width - legendWidth - 10) + "," + (height - 46) + ")");

  legend.append("text")
    .attr("x", legendWidth / 2)
    .attr("y", -8)
    .attr("text-anchor", "middle")
    .attr("fill", "white")
    .attr("font-size", "14px")
    .text("Votes");

  legend.selectAll("rect")
    .data(colors)
    .enter()
    .append("rect")
      .attr("x", function (d, i) { return legendScale(boundaries[i]); })
      .attr("width", function (d, i) { return legendScale(boundaries[i + 1]) - legendScale(boundaries[i]); })
      .attr("height", legendHeight)
      .attr("fill", function (d) { return d; });

  legend.append("g")
    .attr("transform", "translate(0," + legendHeight + ")")
    .call(d3.axisBottom(legendScale).tickValues(domainBreaks).tickSize(6))
    .call(function (g) {
      g.select(".domain").remove();
      g.selectAll("line").attr("stroke", "white");
      g.selectAll("text").attr("fill", "white").attr("font-size", "12px");
    });
    })

  }

export { initVotesMap };
