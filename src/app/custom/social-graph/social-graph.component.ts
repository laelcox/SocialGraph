import { Component, OnInit } from '@angular/core';
import * as d3 from 'd3';
import { SimulationNodeDatum, SimulationLinkDatum, style } from 'd3';
// Adapted from https://observablehq.com/@d3/mobile-patent-suits with significant enhancements and customization


// Imported data elements come from CSV and have these properties. Each datum is eventually transformed and should conform to the source and target types from d3.SimulationNodeDatum type, so those are omitted here, but may need to be redefined if we add custom manipulations.
interface ICore_Data extends d3.SimulationLinkDatum<d3.SimulationNodeDatum>{
  connection: string;
  connection_freq: string;
  max_freq: string;
  min_freq: string;
  person_A_id_str: string;
  person_A_number_followers: string;
  person_A_number_following: string;
  person_A_number_tweets: string;
  person_A_username: string;
  person_B_id_str: string;
  person_B_number_followers: string;
  person_B_number_following: string;
  person_B_number_tweets: string;
  person_B_username: string;
  relationship: string;
  relationship_type: string;
  source_freq: string;
  source_person_type: string;
  source_target: string;
  target_freq: string;
  target_person_type: string;
    // target: d3.SimulationNodeDatum | string | number;
    //source: d3.SimulationNodeDatum | string | number;
}

// Persons A and Persons B are extracted from incoming data and flattened into a singular node structure with these properties.  
interface IAugmented_Person {
  person_id_str: string;
  person_username: string;
  person_number_followers: string;
  person_number_following: string;
  person_number_tweets: string;
  person_type: string;
}

// The D3 library has its own types needed for the "force simulation". During our first transformation, we add a single optional property.
interface INode_Pre extends d3.SimulationNodeDatum{
  id?: string | number | d3.SimulationNodeDatum;
}

// The following custom properties are added to nodes for potential display in the visualization 
interface INode extends INode_Pre{
  person_id_str?: string;
  person_number_followers?: string;
  person_number_following?: string;
  person_number_tweets?: string;
  person_type?: string;
  person_username?: string;
}

// Eventually, nodes deviate from the built-in type structure for the 'id' property and operate using a more restricted type, defined here.
interface INode_Datum extends Omit<INode, "id">{
  id: d3.SimulationNodeDatum;
}

// Standard Angular decorator overhead, specifying that HTML selector that will encapsulate the component as well as the html template and styles used in the view
// When constructing the final build, execute the following CLI command:
// ng build --base-href /angular-d3/ 
@Component({
  selector: 'app-social-graph',
  templateUrl: './social-graph.component.html',
  styleUrls: ['./social-graph.component.scss']
})


export class SocialGraphComponent implements OnInit {

  // Define the key data structures needed throughout the class
  private nodes!: INode[];
  private links!: ICore_Data[];
  private svg: SVGElement | {} | HTMLElement | any;
  private height: number = window.innerHeight||document.documentElement.clientHeight||document.body.clientHeight;
  private width: number = window.innerWidth||document.documentElement.clientWidth||document.body.clientWidth;

  //===========================================================================

  constructor() { }

  ngOnInit(): void {
    // Data comes in using the d3 import function using a promise to then execute setup.
    d3.csv("assets/Twitter_D3.csv").then(csv => this.setup(csv));

    // console.log("width: ", this.width, "height: ", this.height);
  }

  private getErrorMessage(error: unknown) {
    let message = 'Unknown error'
    if (error instanceof Error) return error.message
    return String(error)
  }

  private reportError = ({message}: {message: string}) => {
    // send the error to our logging service...
  }

  private setup(data_imported: any): void {
    // First, execute data manipulation and then build the SVG
    // Next version: Consider building this flow using a promise
    try {
      this.prepData(data_imported as ICore_Data[]);
      if (this.nodes == undefined || this.links == undefined) {
        throw new Error('Data not imported.')
      }
    } catch (error:any) {
      console.error(error.message)
      this.reportError({message: this.getErrorMessage(error)})
    }
    
    this.createSvg();
  }

  private prepData(data_initial: ICore_Data[]): void {
    // console.log("initial", data_initial);

    // Filter data based on conditions
    let data_filtered = data_initial.filter((data_item:any, index:any, array:any) => {
      let cutOffPoint = 7;
      let handlesToExclude = [''] //Specify any handles to exclude

      // Test the number of mutual connections relative to a cutoff point
      if (data_item.target_freq < cutOffPoint || data_item.source_freq < cutOffPoint) {
        return false
      }

      // Exclude if the handle is in the list to be excluded
      else if (handlesToExclude.includes(data_item.person_A_username)) {
        return false
      }
      
      else {
        return true;
      };
    })
    // console.log("data filtered", data_filtered);
    
    // Construct a set of all the unique relationships "source-target" from the imported data 
    let nodes_initial: INode_Pre[] = Array.from(new Set(data_filtered.flatMap(l => [l.source, l.target])), id => ({id}))

    // Construct a list of list (duplicates okay at this point) of all the persons that appear in either the source or target field.
    // Create a base array to collect the data
    let twitter_user_list: IAugmented_Person[] = []

    // Cycle through multiple columns of the original CSV data and push data to the twitter_user_list 
    data_filtered.map((d:ICore_Data) => {
      // Assess if the user is a participant in the initiative or a related contact
      let person_A_type = d.person_A_id_str == d.source ? d.source_person_type : d.target_person_type;
      let person_B_type = d.person_B_id_str == d.source ? d.source_person_type : d.target_person_type;

      // Extract all data first from Person A and Person B columns
      twitter_user_list.push({person_id_str : d.person_A_id_str, person_username: d.person_A_username, person_number_followers: d.person_A_number_followers, person_number_following: d.person_A_number_following, person_number_tweets: d.person_A_number_tweets, person_type: person_A_type})
      twitter_user_list.push({person_id_str : d.person_B_id_str, person_username: d.person_B_username, person_number_followers: d.person_B_number_followers, person_number_following: d.person_B_number_following, person_number_tweets: d.person_B_number_tweets, person_type: person_B_type})
    });


    // Pull in data from the twitter_user_list for use in the required node structure
    let nodes_augmented: INode[] = nodes_initial.map((d: INode_Pre): INode =>  {

      // Create a function that looks up a person from the twitter_user_list
      let index = twitter_user_list.findIndex((ap:IAugmented_Person) => {
        // console.log(fd.person_id_str, d.id);
        return ap.person_id_str == d.id;
      })

      // Introduce a new variable to recast the type of each datum
      let new_d: INode = d as INode

      // Pull in additional data elements from the twitter_user_list
      if (index >= 0) {
        new_d.person_id_str = twitter_user_list[index].person_id_str,
        new_d.person_username = twitter_user_list[index].person_username,
        new_d.person_number_followers = twitter_user_list[index].person_number_followers,
        new_d.person_number_following = twitter_user_list[index].person_number_following,
        new_d.person_number_tweets = twitter_user_list[index].person_number_tweets,
        new_d.person_type = twitter_user_list[index].person_type
      } 
      return new_d;
    });

    // Transfer the final data structure to the class properties
    // Consider translating this into a returned value used in a promise structure
    this.links = data_filtered; 
    this.nodes = nodes_augmented;
    // console.log("links", this.links);
    // console.log("nodes", this.nodes);
  }

  // Create an SVG by definining elements and properties using D3js
  private createSvg(): void {
    // FORCE SIMULATION SETUP ================================================================
    // Set up the basic force simulation using node information. This function augments the node data structure with additional structural pieces.
    let simulation = (d3.forceSimulation(this.nodes) 
    // Pass in the link information, which ties to the nodes (linked by the id propert) and add properties to capture the coordinates for drawing link lines
    .force("link", d3.forceLink(this.links) 
    // Specify the data property to be used for the node id. By using d.id, you refer to the node names IN THE LINK OBJECT. Alternatively, specifying the use of d.index refers to the index property of the nodes
    .id((d:any) => {/*console.log(d);*/ return d.id})))
    // Specify parameters, such as attraction/repulsion, coordinates around which the force is centered, and which properties the force should operate on
    .force("charge", d3.forceManyBody().strength(-825))
    .force("center",d3.forceCenter(-1, 1))
    .force("x", d3.forceX())
    .force("y", d3.forceY());
    //console.log(this.links);

    // SVG SETUP ================================================================
    // Get a handle on a div in the html template and add a container SVG object, specifying key properties.
    this.svg = d3.select("figure#force-graph")
      .append("svg")
      .attr("width",this.width)
      .attr("height",this.height)
      // The Angular template specifies that the body should be max-width 750px. With no such constraints, I would use the following code instead.
      // .attr("viewBox", [-this.width / 2, -this.height / 2, this.width, this.height])
      .attr("viewBox", [-750 / 2, -this.height / 2, this.width, this.height])
      .style("font", "14px sans-serif");

    // POPUP SETUP =============================================================
    // Get a handle for the popup that will display node information. Specify styles that you would otherwise control via CSS. The popup is handled outside of the SVG as a DIV
    let popup = d3.select("figure#force-graph")
      .append("div")
      .attr("class", "popup")               
      .style("opacity", 0)
      .style("pointer-events", "none")
      .style("position", "absolute")
      // .style("text-align", "left")
      .style("width", "160px")
      .style("background", "#e5e500")
      .style("border", "0px")
      .style("border-radius", "8px")
      .style("color","gray")
      .style("padding", "5px 10px 5px 10px");
    
    // Create divs inside of the popup for multi-line display and custom styling of header
    let popupHeader = popup.append("div")
      .attr("class", "popup-header")
      .style("font-weight", "1000")
      .style("font-size", "14px")
    let popupNumberTweets = popup.append("div")
      .attr("class", "popup-body")
      .style("font-size", "12px")
    let popupNumberFollowers = popup.append("div")
      .attr("class", "popup-body")
      .style("font-size", "12px")
    let popupNumberFollowing = popup.append("div")
      .attr("class", "popup-body")
      .style("font-size", "12px")

    // LEGEND SETUP =======================================================================
    // Create an SVG group/component to handle the legend
    let legend = this.svg
      .append("g")
      .attr("id","legend")
      // Position the Legend. 0,0 is center of the SVG pane
      .attr("transform","translate(" + (-750/2) + "," + (-this.height/2 + 20) + ")");

    // Create the legend entry for following relationships
    let following = legend.append("g")
      .attr("id","following");
    following.append("line")
      .attr("x1",0)
      .attr("y1",0)
      .attr("x2",25)
      .attr("y2",0)
      .style("stroke","red")
      .style("stroke-width",3)
      .style("opacity",0.6);
    following.append("text")
      .attr("x", 35)
      .attr("y", 5)
      .text("following")
      .attr("fill", "white")
      .attr("stroke", "none");

    // Create the legend entry for followed-by relationships
    let followedBy = legend.append("g")
      .attr("id","followedBy");
    followedBy.append("line")
      .attr("x1",0)
      .attr("y1",25)
      .attr("x2",25)
      .attr("y2",25)
      .style("stroke","blue")
      .style("stroke-width",3)
      .style("opacity",0.6);
    followedBy.append("text")
      .attr("x", 35)
      .attr("y", 30)
      .text("followed by")
      .attr("fill", "white")
      .attr("stroke", "none");

    // Create the legend entry for reciprocal relationships
    let reciprocal = legend.append("g")
      .attr("id","reciprocal");
    reciprocal.append("line")
      .attr("x1",0)
      .attr("y1",50)
      .attr("x2",25)
      .attr("y2",50)
      .style("stroke","yellow")
      .style("stroke-width",3)
      .style("opacity",0.6);
    reciprocal.append("text")
      .attr("x", 35)
      .attr("y", 55)
      .text("following and followed by")
      .attr("fill", "white")
      .attr("stroke", "none");

    // Create the legend entry for node relationships
    let node_legend = legend.append("g")
      .attr("id","node_legend");
    reciprocal.append("circle")
      .attr("r",4)
      .attr("cx",13)
      .attr("cy",75)
      .style("fill", "white")
      .style("stroke-width",0)
      .style("opacity",0.8);
    reciprocal.append("text")
      .attr("x", 35)
      .attr("y", 80)
      .text("size based on # Tweets")
      .attr("fill", "white")
      .attr("stroke", "none");

    // Create the legend entry for node text colors
    let node_text_color = legend.append("g")
      .attr("id","node_text_color");
    reciprocal.append("text")
      .attr("x", 35)
      .attr("y", 105)
      .text("participant")
      .attr("fill", "steelblue")
      .attr("stroke", "none");

    let other_contact = legend.append("g")
      .attr("id","other_contact");
    reciprocal.append("text")
      .attr("x", 35)
      .attr("y", 130)
      .text("related contact")
      .attr("fill", "white")
      .attr("stroke", "none");

    // GRADIENT SETUP =========================================================
    // This was code exploring the use of gradients in the connecting line. Ultimately, it was not used. 
    // let defs = this.svg.append("defs")
    // let gradientFollowing = defs.append("linearGradient")
    //   .attr("id","gradient-following")
    //   .attr("x1","0%")
    //   .attr("y1","0%")
    //   .attr("x2","100%")
    //   .attr("y2","100%");
    // gradientFollowing.append("stop")
    //     .attr("offset","0%")
    //     .attr("stop-color","red");
    // gradientFollowing.append("stop")
    //   .attr("offset","100%")
    //   .attr("stop-color","steelblue");
    // let gradientFollowedBy = defs.append("linearGradient")
    //   .attr("id","gradient-followed-by")
    //   .attr("x1","0%")
    //   .attr("y1","0%")
    //   .attr("x2","100%")
    //   .attr("y2","100%");
    //   gradientFollowedBy.append("stop")
    //     .attr("offset","0%")
    //     .attr("stop-color","steelblue");
    //   gradientFollowedBy.append("stop")
    //     .attr("offset","100%")
    //     .attr("stop-color","red");

    // SETUP & STYLE LINKS ============================================================
    // Create the SVG paths that will serve as links. Connect them to the links data source
    let link = this.svg.append("g")
      .attr("fill", "none")
      .attr("stroke-width", 1.5)
      .selectAll("path")
      // Join data to the links
      .data(this.links)
      .join("path")
      //Style the links
      .style("stroke","steelblue")
      .style("opacity",0.25);

    // SETUP BEHAVIOR WHEN NODES ARE HOVER TARGETS =================================================
    // When nodes are hover targets, highlight links in different behaviors based on type
    let overed = (ev:any, nodeDatum:any) => {
      // Initialize storage arrays for link types
      let followingCombinations: any[] = [];
      let followedByCombinations: any[] = [];
      let reciprocalCombinations: any[] = [];

      // Isolate links that only Following and style them
      let following = link.filter((d:any,i:number) => { if (d.source.id == nodeDatum.id && d.relationship_type === "One-Way") followingCombinations.push([d.source.id, d.target.id, d.relationship_type]); return d.source.id == nodeDatum.id })
      .attr("stroke-width",5)
      .style("stroke","red") //"url(#gradient-following)"
      .style("opacity",0.6);

      // Isolate links that only Followed By and style them
      let followedBy = link.filter((d:any,i:number) => { if (d.target.id == nodeDatum.id && d.relationship_type === "One-Way") {followedByCombinations.push([d.source.id, d.target.id, d.relationship_type]); return true} else {return false} })
      .attr("stroke-width",5)
      .style("stroke","blue") //"url(#gradient-followedBy)"
      .style("opacity",0.6);

      // Isolate reciprocal links and style them
      let reciprocal = link.filter((d:any,i:number) => { if ((d.target.id == nodeDatum.id || d.source.id == nodeDatum.id) && d.relationship_type === "Reciprocal") {reciprocalCombinations.push([d.source.id, d.target.id, d.relationship_type]); return true} else { return false }})
      .attr("stroke-width",5)
      .style("stroke","yellow")
      .style("opacity",0.6);

      // Setup popup behavior and display relevant node data
      // Make popup visible
      popup.transition().duration(500).style("opacity", .0)
      popup.transition().duration(200).style("opacity", 1)
      // Position popup relative to node
      let popupX = (ev.pageX - 210) < 0 ? 0 : ev.pageX - 210
      let popupY = (ev.pageX - 210) < 0 ? ev.pageY - 107 : ev.pageY - 28
      popup.style("left", popupX + "px")
        .style("top", popupY + "px");
      // Populate popup data
      popupHeader.html(nodeDatum.person_username)
      popupNumberTweets.html("# Tweets: " + Number(nodeDatum.person_number_tweets).toLocaleString('en-US'))
      popupNumberFollowers.html("# Followers: " + Number(nodeDatum.person_number_followers).toLocaleString('en-US'))
      popupNumberFollowing.html("# Following: " + Number(nodeDatum.person_number_following).toLocaleString('en-US'))
    }

    // When nodes are no longer hover targets, turn links back to normal
    let outed = (ev:any, nodeDatum:d3.SimulationNodeDatum) =>{
      // Turn links back to normal
      link.attr("stroke-width",1.5)
      .style("stroke","steelblue")
      .style("opacity",0.25);
      // Hide the popup
      popup.transition()        
      .duration(350)      
      .style("opacity", 0); 
    }

    // SETUP AND STYLE NODES =====================================================
    // Append SVG group for each node
    let node = this.svg.append("g")
    // Style the node
    .attr("fill", "currentColor")
    .attr("stroke-linecap", "round")
    .attr("stroke-linejoin", "round")
    .selectAll("g")
    // Join data to each node
    .data(this.nodes)
    .join("g")
    // Apply drag and drop behavior to node
    .call(this.drag(simulation));
    // Specify behavior when hover target
    node.on("mouseover",overed)
      .on("mouseout",outed);

    // Append a circle to each node group and style it
    node.append("circle")
      .attr("stroke", "white")
      .attr("opacity", "0.8")
      .attr("stroke-width", 1.5)
      // Specify radius size using a formula
      .attr("r", (d:any) => { return Math.min(15, Math.max(3, d.person_number_tweets/3000))});
    
    // Append text to each node group, specify data to appear, position and style it
    node.append("text")
      .attr("x", 8)
      .attr("y", "0.31em")
      .text((d:INode) => d.person_username) //wrapped d:any in ()
      .attr("fill", (d:any)=> {
        // console.log('nodes', d);
        if (d.person_type == 'challenge') {return "steelblue"} else {return "white"}
      })
      .attr("stroke", "none")
      .attr("font-size",(d:any)=> {
        if (d.person_type == 'challenge') {return 25} else {return 14}
      });

    // SIMULATION BEHAVIOR ===============================================================
    // The simulation cycles through a series of time ticks and applies a new calculation for positioning and velocity for each node and linke with each tick 
    simulation.on("tick", () => {
      // Apply the linkArc function below to the links after the tick has repositioned the nodes. Applying the function to the links (which maintain a relationship to the force simulation object) automatically updates the values and positioning of the links.
      link.attr("d", this.linkArc);
      // Apply the linkArc function below to the nodes after the tick has repositioned the nodes. Applying the function to the nodes (which maintain a relationship to the force simulation object) automatically updates the values and positioning of the nodes. In the code below introduces a positioning constraint to help node text labels avoid going outside of the pane. This constraint is evaluated in the next force simulation tick and causes other nodes to reposition around this constraint.
      node.attr("transform", (d:any) => {
        return "translate(" + (d.x < (-this.width/2 + 20) ? d.x = (-this.width/2 + 20) : d.x > (this.width/2 - 20) ? d.x = (this.width/2 - 20) : d.x) +
            "," + (d.y < (-this.height/2 + 20) ? d.y = (-this.height/2 + 20) : d.y > (this.height/2 - 20) ? d.y = (this.height/2 - 20) : d.y) + ")"
      });
    });
  }

  // HELPER FUNCTIONS ===========================================================
  // Specify the arc for links
  linkArc = (d:any) => {
    const r = Math.hypot(d.target.x - d.source.x, d.target.y - d.source.y);
    return `
      M${d.source.x},${d.source.y}
      A${r},${r} 0 0,1 ${d.target.x},${d.target.y}
    `;
  }

  // Specify drag behavior
  private drag = (simulation: any) => {
    function dragstarted(el:any, d:any) {
      if (!el.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }
    
    function dragged(el:any, d:any) {
      d.fx = el.x;
      d.fy = el.y;
    }
    
    function dragended(el:any, d:any) {
      if (!el.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
    
    return d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
  }
  
}
