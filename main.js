const Apify = require("apify");
const request = require("request-promise");
const DomParser = require("dom-parser");
const xlsx = require("node-xlsx");
const fs = require("fs");
const util = require("util");

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const parser = new DomParser();

const api = {};
api.enan = {
  encoding: null
};
api.mzcr = "https://onemocneni-aktualne.mzcr.cz/covid-19";
api.quar = "https://www.cssz.cz/documents/20143/648807/Statistika_hlasene_karanteny_Z209-pocet_pripadu_souhrnne_za_2020_podle_kraju_a_okresu.xlsx/9d3b34d3-5df2-7fd5-264e-be89d267dae2";
api.r0 = "https://api.apify.com/v2/key-value-stores/DO0Mg4d1cPbWhtPSD/records/LATEST?disableRedirect=true";
api.hygDistricts = "https://api.apify.com/v2/key-value-stores/EIolfU3CUlHlpQH5M/records/LATEST?disableRedirect=true";

/**
 *
 */
class Helpers {
  /**
   * Changes time based on parameters, can add or remove days, months, years etc.
   * @param {string} input date on input
   * @param {integer} days days to add or remove, default 0
   * @param {integer} months months to add or remove, default 0
   * @param {integer} years years to add or remove, default 0
   * @returns {date} returns date
   */
  deltaDate(input, days, months, years) {
    const date = new Date(input);
    date.setDate(date.getDate() + days);
    date.setMonth(date.getMonth() + months);
    date.setFullYear(date.getFullYear() + years);
    return date;
  }

  /**
   * Pads the number in case if someone forgets 0 before, eg 3 becomes 03 etc.
   * @param {string} inputNumber number to pad
   * @returns {string} returns string with 0
   */
  padTheNumber(inputNumber) {
    const number = parseInt(inputNumber, 10);
    return number > 9 ? `${number}` : `0${number}`;
  }

  /**
   * Sort data by key, to make them in order (sometimes keys are not in order)
   * @param {array} original Original data to be sorted by key
   * @return {array} returns ordered array
   */
  sortData(original) {
    const ordered = {};
    Object.keys(original).sort().forEach((key) => {
      ordered[key] = original[key];
    });
    return ordered;
  }

  /**
   * Push to array by date
   * @param {*} array original array
   * @param {*} date date that will be the key for pushed array
   * @param {*} arrayPushed array that is going to be pushed into the key (date)
   * @return {array} returns final array
   */
  pushToArrayByDate(array, date, arrayPushed) {
    const newArray = array;
    if (newArray[date] === undefined) {
      newArray[date] = [];
    }
    newArray[date].push(arrayPushed);
    return newArray;
  }

  /**
   * Parse whole quarantine data, has to be outside, cuz async, need to write
   * and read because it's zipped
   * @param {object} xlsCrawl object with all the xlsKaranteny data
   * @returns {sheet} parsed xls sheet data
   */
  async parseQuarantineXLS(xlsCrawl) {
    // write file
    try {
      await writeFile("quarantine.xlsx", xlsCrawl);
    } catch (err) {
      throw err;
    }

    // and read file file
    let sheet = "";
    try {
      sheet = await readFile(`${__dirname}/quarantine.xlsx`);
    } catch (err) {
      throw err;
    }

    sheet = xlsx.parse(sheet);

    return sheet;
  }
}

const hlp = new Helpers(); // run automatically

/**
 *  Get, parse data and prepare array.
 * @class
 * @classdesc Class is getting and parsing the data, to prepare array that we
 *  will work on later on.
 */
class GetData {
  /**
   * @param {oblect} htmlCrawlMZCR object with html dom data
   * @param {object} xlsCrawl object with all the xlsKaranteny data
   * @param {object} jsonApiR0 object with all the json api data
   * @param {object} jsonAPIhygDistricts object with all the jsonAPIhygDistricts data
   */
  constructor(htmlCrawlMZCR, xlsCrawl, jsonApiR0, jsonAPIhygDistricts) {
    this.htmlMZCR = parser.parseFromString(htmlCrawlMZCR);
    this.xlsKaranteny = xlsCrawl; // already parsed before, cuz await
    this.jsonApiR0 = jsonApiR0;
    this.jsonAPIhygDistricts = jsonAPIhygDistricts;
  }

  /**
   * Function to modify dates in computer readable format with dashes
   * @param {string} dateInCzechFormat gets date in czech format eg. 14.03.2020
   * @returns {string} computer readable date eg. 2020-03-14
   */
  readableDate(dateInCzechFormat) {
    const date = dateInCzechFormat.split(".");
    const day = hlp.padTheNumber(date[0]);
    const month = hlp.padTheNumber(date[1]);
    const year = hlp.padTheNumber(date[2]);
    const parsableDate = `${year}-${month}-${day}`;
    return parsableDate;
  }

  /**
   * Get Attribute from sourceHTML.
   * @param {string} query Query Selector, for the ID where attribute with data
   *  is located
   * @returns {string} computer readable date eg. 2020-03-14
   */
  DataFromDataAttribute(query) {
    let data = {};
    const dataTable = this.htmlMZCR.getElementById(query);
    if (dataTable) {
      const dataTableAttributes = dataTable.getAttribute("data-table");

      let dataTableString = dataTableAttributes.toString();
      dataTableString = dataTableString.replace(/&quot;/g, "\"");

      const dataTableJson = JSON.parse(dataTableString);
      data = dataTableJson.body;
    }

    return data;
  }

  /**
   * Gets Data with total Dead people
   * @param {object} sourceHtml source DOM where to look at
   * @return {array} returns array with all the data
   */
  TotalDied() {
    const data = this.DataFromDataAttribute("js-total-died-table-data");

    let final = [];

    for (let i = 0; i < data.length; i++) {
      const person = data[i];
      const date = this.readableDate(person[0]);
      const prepareData = [person[1], person[2]];
      // [prepareData] = person[1];
      // [, prepareData] = person[2];

      final = hlp.pushToArrayByDate(final, date, prepareData);
    }

    final = hlp.sortData(final);
    return final;
  }

  /**
   * Gets Data with total Positive people
   * @return {array} returns array with all the data
   */
  TotalPositive() {
    const data = this.DataFromDataAttribute("js-cummulative-total-positive-table-data");

    let final = [];

    for (let i = 0; i < data.length; i++) {
      const day = data[i];
      const date = this.readableDate(day[0]);
      const prepareData = day[1];

      final = hlp.pushToArrayByDate(final, date, prepareData);
    }

    final = hlp.sortData(final);
    return final;
  }

  /**
   * Gets Data with total Tested people
   * @param {object} sourceHtml source DOM where to look at
   * @return {array} returns array with all the data
   */
  TotalTests() {
    const data = this.DataFromDataAttribute("js-cummulative-total-tests-table-data");

    let final = [];

    for (let i = 0; i < data.length; i++) {
      const day = data[i];
      const date = this.readableDate(day[0]);
      const prepareData = day[1];

      final = hlp.pushToArrayByDate(final, date, prepareData);
    }

    final = hlp.sortData(final);
    return final;
  }

  /**
   * Gets Data with all Hospitalized people
   * @param {object} sourceHtml source DOM where to look at
   * @return {array} returns array with all the data
   */
  HospitalizationData() {
    // very unstable
    const table = this.htmlMZCR.getElementsByClassName("equipmentTable")[0];
    if (!table) {
      return [];
    }

    let final = [];
    const tbody = table.childNodes[3];

    tbody.childNodes.forEach((row) => {
      if (row.nodeName === "tr") {
        let index = 0;
        let date = "";
        const prepareData = [];

        row.childNodes.forEach((element) => {
          if (element.nodeName === "td") {
            if (index === 0) {
              date = this.readableDate(element.innerHTML);
            }
            if (index === 1) {
              prepareData[0] = element.innerHTML;
            }
            if (index === 2) {
              prepareData[1] = element.innerHTML;
            }
            if (index === 3) {
              prepareData[2] = element.innerHTML;
            }
            if (index === 4) {
              prepareData[3] = element.innerHTML;
            }
            if (index === 5) {
              prepareData[4] = element.innerHTML;
            }
            index += 1;
          }
        });

        if (!date.includes(NaN)) {
          final = hlp.pushToArrayByDate(final, date, prepareData);
        }
      }
    });

    // final = hlp.sortData(final);
    return final;
  }

  /**
   * Get all the Quarantine data
   * @return {array} returns array with all the data
   */
  QuarantineData() {
    let kraje = [];
    for (let index = 0; index < this.xlsKaranteny.length; index++) {
      const list = this.xlsKaranteny[index];

      if (list.name === "Statistika podle krajů") {
        kraje = list.data;
      }
    }

    const final = [];

    const regionsNamed = ["Hlavní město Praha", "Středočeský kraj", "Jihočeský kraj", "Plzeňský kraj", "Karlovarský kraj", "Ústecký kraj", "Liberecký kraj", "Královéhradecký kraj", "Pardubický kraj", "Kraj Vysočina", "Jihomoravský kraj", "Olomoucký kraj", "Zlínský kraj", "Moravskoslezský kraj"];

    for (let index = 0; index < kraje.length; index++) {
      const row = kraje[index];
      if (index > 3) {
        if (typeof row !== "undefined" && row.length > 0) {
          // the array is defined and has at least one element
          const daysSince1900 = row[0];
          const total = row[16];
          const regions = {};

          if (total && total > 0) {
            const oneDay = 24 * 60 * 60 * 1000; // hours*minutes*seconds*milliseconds

            let date = (daysSince1900) * oneDay;
            date = new Date(date);
            date = hlp.deltaDate(date, -2, 0, -70); // cuz Excel is weird
            date = date.toISOString().substring(0, 10);

            for (let region = 0; region < regionsNamed.length; region++) {
              const regionName = regionsNamed[region];
              const regionID = region + 1;
              regions[regionName] = row[regionID];
            }

            final[date] = [];
            final[date].n = total;
            final[date].r = regions;
          }
        }
      }
    }
    return final;
  }

  /**
   * Gets Data from R0 api
   * @return {array} returns array with all the data
   */
  ApiR0() {
    const apiData = this.jsonApiR0;
    const parsed = JSON.parse(apiData);
    const {
      data
    } = parsed;
    const final = [];

    for (let i = 0; i < data.length; i++) {
      const [date, min, med, max] = data[i];
      final[date] = [min, med, max];
    }

    // final = hlp.sortData(final);
    return final;
  }

  /**
   * Gets Data from hygiene districts
   * @return {array} returns array with all the data
   */
  ApiHygieneDistricts() {
    const apiData = this.jsonAPIhygDistricts;
    const parsed = JSON.parse(apiData);
    const {
      data
    } = parsed;

    return data;
  }
}


/**
 *  Glue the data all together
 * @class
 * @classdesc Class is getting and parsing the data, to prepare array that we will work on later on.
 */
class GlueTogether {
  /**
   *  Glue Together all the information
   * @param {class} get Class that parses the info
   */
  constructor(get) {
    this.totalDied = get.TotalDied();
    this.totalCases = get.TotalPositive();
    this.totalTests = get.TotalTests();
    this.totalHospital = get.HospitalizationData();
    this.totalQuarantine = get.QuarantineData();
    this.apiR0 = get.ApiR0();
    this.apiHygieneDistricts = get.ApiHygieneDistricts();

    // original: new Date(2020, 0, 27);
    // short one: new Date(2020, 1, 27);
    this.oldestDateDaily = new Date(2020, 1, 27);
    this.oldestDateRegion = new Date(2020, 1, 27);
    this.nowDate = new Date();

    this.numberDeathsTotal = 0;
    this.numberTestsYesterday = 0;
    this.numberTestsTotal = 0;
    this.numberCasesYesterday = 0;
    this.numberCasesTotal = 0;
    this.numberQuarantine = 0;

    this.numberHospitalizedNow = 0;
    this.numberHospitalizedCritical = [0, ""];
    this.numberHospitalizedHealed = [0, ""];
    this.numberQuarantineRegions = [];
  }

  /**
   * Get date in the same format
   * @param {string} date Date
   * @return {array} returns array with all the data
   */
  dateInDashFormat(date) {
    // getting day in readable format
    const dayDate = new Date(date);
    const dtf = new Intl.DateTimeFormat("en", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    const [{
      value: mo
    }, , {
        value: da
      }, , {
        value: ye
      }] = dtf.formatToParts(dayDate);
    const day = `${ye}-${mo}-${da}`;
    return day;
  }

  /**
   * Test if the data is iterable
   * @param {array} checkIfIterable array to test if iterable
   * @param {string} day day that works as key
   * @return {array} returns true or false
   */
  isIterable(checkIfIterable, day) {
    // write only if available
    if (checkIfIterable) {
      if (checkIfIterable[day]) {
        return true;
      }
    }
    return false;
  }

  /**
   * All the Cases data
   * @param {string} day day that works as key
   * @return {array} returns array with all the data
   */
  Cases(day) {
    let numberCasesNow = 0;

    [this.numberCasesTotal] = this.totalCases[day];
    numberCasesNow = this.numberCasesTotal - this.numberCasesYesterday;
    this.numberCasesYesterday = this.numberCasesTotal;

    const prepareFormattedData = {};
    prepareFormattedData.n = numberCasesNow;
    prepareFormattedData.t = this.numberCasesTotal;

    return prepareFormattedData;
  }

  /**
   * All the Tests data
   * @param {string} day day that works as key
   * @return {array} returns array with all the data
   */
  Tests(day) {
    let numberTestsNow = 0;

    [this.numberTestsTotal] = this.totalTests[day];
    numberTestsNow = this.numberTestsTotal - this.numberTestsYesterday;
    this.numberTestsYesterday = this.numberTestsTotal;

    const prepareFormattedData = {};
    prepareFormattedData.n = numberTestsNow;
    prepareFormattedData.t = this.numberTestsTotal;

    return prepareFormattedData;
  }

  /**
   * All the Deaths data
   * @param {string} day day that works as key
   * @return {array} returns array with all the data
   */
  Deaths(day) {
    let numberDeathsNow = 0;

    if (this.totalDied[day]) {
      for (let index = 0; index < this.totalDied[day].length; index++) {
        this.numberDeathsTotal += 1;
        numberDeathsNow += 1;
      }
    }

    const prepareFormattedData = {};
    prepareFormattedData.n = numberDeathsNow;
    prepareFormattedData.t = this.numberDeathsTotal;

    return prepareFormattedData;
  }

  /**
   * All the Hospitalized data
   * @param {string} day day that works as key
   * @return {array} returns array with all the data
   */
  Hospitalized(day) {
    const [hospDay] = this.totalHospital[day];

    this.numberHospitalizedNow = parseInt(hospDay[0], 10);
    this.numberHospitalizedCritical = [parseInt(hospDay[1], 10), hospDay[2]];
    this.numberHospitalizedHealed = [parseInt(hospDay[3], 10), hospDay[4]];

    const prepareFormattedData = {};
    prepareFormattedData.t = this.numberHospitalizedNow;
    prepareFormattedData.c = [this.numberHospitalizedCritical[0],
      this.numberHospitalizedCritical[1]
    ];
    prepareFormattedData.h = [this.numberHospitalizedHealed[0],
      this.numberHospitalizedHealed[1]
    ];

    return prepareFormattedData;
  }

  /**
   * All the Quarantined data
   * @param {string} day day that works as key
   * @return {array} returns array with all the data
   */
  Quarantined(day) {
    this.numberQuarantine = parseInt(this.totalQuarantine[day].n, 10);

    const prepareFormattedData = {};
    prepareFormattedData.n = this.numberQuarantine;

    return prepareFormattedData;
  }

  /**
   * All the R0 data
   * @param {string} day day that works as key
   * @return {array} returns array with all the data
   */
  R0(day) {
    const R0day = { };
    [R0day.n] = this.apiR0[day];
    [, R0day.d] = this.apiR0[day];
    [,, R0day.x] = this.apiR0[day];
    return R0day;
  }

  /**
   * All the QuarantinedByRegions data
   * @param {string} day day that works as key
   * @return {array} returns array with all the data
   */
  QuarantinedByRegions(day) {

  }

  /**
   * Create array that keys are differentiated by Day
   * @return {array} returns array with all the data
   */
  Daily() {
    const dailyArray = [];
    for (let d = this.oldestDateDaily; d <= this.nowDate; d.setDate(d.getDate() + 1)) {
      const day = this.dateInDashFormat(d);
      const dailyData = {};

      if (this.isIterable(this.totalCases, day)) {
        dailyData.c = this.Cases(day);
      }

      if (this.isIterable(this.totalTests, day)) {
        dailyData.t = this.Tests(day);
      }

      if (this.isIterable(this.totalDied, day)) {
        dailyData.d = this.Deaths(day);
      }

      if (this.isIterable(this.totalHospital, day)) {
        dailyData.h = this.Hospitalized(day);
      }

      if (this.isIterable(this.totalQuarantine, day)) {
        dailyData.q = this.Quarantined(day);
      }

      if (this.isIterable(this.apiR0, day)) {
        dailyData.r0 = this.R0(day);
      }

      dailyArray[day] = dailyData;
    }

    return dailyArray;
  }

  /**
   * Create array that keys are differentiated by Day
   * @return {array} returns array with all the data
   */
  Regional() {
    const regionalArray = [];

    for (let d = this.oldestDateRegion; d <= this.nowDate; d.setDate(d.getDate() + 1)) {
      const day = this.dateInDashFormat(d);

      if (this.totalQuarantine[day]) {
        if (this.totalQuarantine[day].r) {
          const regions = this.totalQuarantine[day].r;

          Object.keys(regions).forEach((region) => {
            if (regionalArray[region] === undefined) {
              regionalArray[region] = {};
            }

            if (regionalArray[region].quarantine === undefined) {
              regionalArray[region].quarantine = {};
            }

            regionalArray[region].quarantine[day] = regions[region];
          });
        }
      }

      if (this.totalDied[day]) {
        const deaths = this.totalDied[day];

        Object.keys(deaths).forEach((death) => {
          const [age, region] = deaths[death];

          if (regionalArray[region] === undefined) {
            regionalArray[region] = {};
          }

          if (regionalArray[region].deaths === undefined) {
            regionalArray[region].deaths = {};
          }

          if (regionalArray[region].deaths[day] === undefined) {
            regionalArray[region].deaths[day] = [];
          }

          regionalArray[region].deaths[day].push(age);
        });
      }

      if (this.apiHygieneDistricts[day]) {
        const regions = this.apiHygieneDistricts[day];

        Object.keys(regions).forEach((region) => {
          const districts = regions[region];

          Object.keys(districts).forEach((district) => {
            const cases = districts[district];

            if (regionalArray[region] === undefined) {
              regionalArray[region] = {};
            }

            if (regionalArray[region].cases === undefined) {
              regionalArray[region].cases = {};
            }

            if (regionalArray[region].cases[district] === undefined) {
              regionalArray[region].cases[district] = {};
            }

            if (regionalArray[region].cases[district][day] === undefined) {
              regionalArray[region].cases[district][day] = [];
            }

            regionalArray[region].cases[district][day] = cases;
          });
        });
      }
    }

    /* const dailyObject = Object.assign({}, regionalArray);
    console.log(JSON.stringify(dailyObject)); */
    return regionalArray;
  }
}

/**
 * Generate some usefull data
 * @class
 * @classdesc Class to generate predefined data
 */
class Generate {
  /**
   * Generate schema so new users can have an idea how the data are generated
   * @returns {string} generated schema
   */
  Schema() {
    const day = "day in YYYY-MM-DD";
    const schema = {};
    schema.daily = {};
    schema.daily[day] = {};
    schema.daily[day]["[c]ases"] = {
      n: "number of cases that day",
      t: "total cases"
    };
    schema.daily[day]["[t]ests"] = {
      n: "number of tests that day",
      t: "total tests"
    };
    schema.daily[day]["[d]eaths"] = {
      n: "number of deaths that day",
      t: "total deaths"
    };
    schema.daily[day]["[h]ospitalizations"] = {
      t: "total hospitalizations",
      c: ["number of critical", "percentage of critical"],
      h: ["number of healed/released", "percentage of healed/released"]
    };
    schema.daily[day]["[q]uarantine"] = {
      n: "number of quarantined that day"
    };
    schema.daily[day]["[r0] basic reproduction number"] = {
      n: "miN: 5th percentile for estimation from last 7 days",
      d: "meD: estimation from last 7 days",
      x: "maX: 95th percentile for estimation from last 7 days"
    };
    schema.regions = {};
    schema.regions.region = {};
    schema.regions.region.quarantine = {
      day: "number of quarantined"
    };
    schema.regions.region.deaths = {
      day: "age group"
    };
    schema.regions.region.cases = {
      district: {
        day: "number of cases"
      }
    };
    return schema;
  }

  /**
   * Generate schema so new users can have an idea how the data are generated
   * @param {object} dailyArray all the data
   * @returns {null} Returns nothing
   */
  ConsoleLog(dailyArray) {
    const dailyObject = Object.assign({}, dailyArray);
    const dailyArrayString = JSON.stringify(dailyObject);

    // console.log(dailyArray);
    console.log(dailyArrayString.length);
    console.log(dailyArrayString);
    console.log(this.Schema());

    // console.log(JSON.stringify(this.Schema()));
  }
}

Apify.main(async () => {

    // request all the data
  const crawlWebMZCR = await request(api.mzcr);
  const xlsCrawlQuarantine = await request(api.quar, api.enan);
  const xlsCrawlQuarantineData = await hlp.parseQuarantineXLS(xlsCrawlQuarantine);
  const jsonAPIr0 = await request(api.r0);
  const jsonAPIhygDistricts = await request(api.hygDistricts);

  // parse data from requests
  const get = new GetData(crawlWebMZCR, xlsCrawlQuarantineData, jsonAPIr0, jsonAPIhygDistricts);

  // glue together all the info
  const glue = new GlueTogether(get);
  const dailyArray = glue.Daily();
  const regionalArray = glue.Regional();

  // generate additional info
  const gen = new Generate();

  const data = {
    daily: {},
    regions: {}
  };
  data.daily = Object.assign({}, dailyArray);
  data.regions = Object.assign({}, regionalArray);

  const schema = gen.Schema();
  // And then save output
  const output = {
    schema,
    lastUpdatedAtApify: new Date(),
    readMe: "https://www.sablatura.info/covid/api",
    data
  };

  gen.ConsoleLog(output);
  

  const {
    keyValueStores
  } = Apify.client;

  const {
    id: storeId
  } = await keyValueStores.getOrCreateStore({
    storeName: "COVID-CZ-history"
  });

  Apify.client.setOptions({
    storeId
  });

  await Apify.setValue("OUTPUT", output);
  await Apify.setValue("SIZE", JSON.stringify(output).length);

  // Just pass the 'key' as the 'keyValueStores' already knows
  // in what 'storeId' to look at.
  const record = await keyValueStores.getRecord({
    key: "LATEST"
  });

    // Check for empty 'STATE' records
  const storeRecord = record && record.body ? record.body : {};

  const previousState = typeof storeRecord === "string"
    ? JSON.parse(storeRecord) : storeRecord;

    // It is a good practice to copy objects instead of
    // overwriting them. Weird things can happen otherwise.
  const nextState = Object.assign({}, previousState, output);

  await keyValueStores.putRecord({
    key: "LATEST",
    body: JSON.stringify(nextState)
  });
});
