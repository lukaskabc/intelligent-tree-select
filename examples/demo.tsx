import React from "react";
import {createRoot} from "react-dom/client";

import data from "./data/data.json";
import {IntelligentTreeSelect} from "../src";
import type {BaseOption, FetchParams} from "../src";
import "../src/styles.css";
import "bootstrap/dist/css/bootstrap.css";

const container = document.getElementById("app");
if (!container) {
  throw new Error("Demo root element was not found");
}

interface DemoOption extends BaseOption {
  "@id": string;
  "http://www.w3.org/2000/01/rdf-schema#label": string;
  "http://www.w3.org/2000/01/rdf-schema#comment"?: string;
  subTerm: string[];
}

const root = createRoot(container);
root.render(
  <IntelligentTreeSelect<DemoOption>
    //name={"main_search"}
    fetchOptions={({searchString, optionID, limit, offset}: FetchParams<DemoOption>) =>
      new Promise<DemoOption[]>((resolve) => {
        //console.log({searchString, optionID, limit, offset});
        setTimeout(resolve, 1000, [
          {
            "@id": "http://onto.fel.cvut.cz/ontologies/eccairs/aviation-3.4.0.2/vl-a-390/v-3000000",
            "http://www.w3.org/2000/01/rdf-schema#label": "3000000 - Consequential Events new",
            "http://www.w3.org/2000/01/rdf-schema#comment": "An event evolving from another event.",
            subTerm: ["http://onto.fel.cvut.cz/ontologies/eccairs/aviation-3.4.0.2/vl-a-390/v-99010132"],
          },
        ]);
      })
    }
    value={["http://onto.fel.cvut.cz/ontologies/eccairs/aviation-3.4.0.2/vl-a-390/v-3000000"]}
    valueKey={"@id"}
    valueIsControlled={false}
    labelKey={"http://www.w3.org/2000/01/rdf-schema#label"}
    childrenKey={"subTerm"}
    titleKey="http://www.w3.org/2000/01/rdf-schema#comment"
    simpleTreeData={true}
    options={data as DemoOption[]}
    renderAsTree={true}
    isMenuOpen={true}
  />
);
