# COVID-19 Czech Data — All in One, Historical & Regional
All in one historical and regional data for every day in YYYY-MM-DD format. It compiles together multiple other APIs.

## Summary
### Historical data
Per a day, shown as YYYY-MM-DD.
- number of cases
- number of tests
- number of deaths
- hospitalizations
- quarantines
- reproductive number

### Development in regions
- quarantines by region
- deaths by region (age is shown as a category: 0-49, 50-59, 60+)
- cases by district (more detailed, since the Ministry of Health publishes only regions, but regional hygiene stations are sharing this data)

## Link to API
API can be found [on Apify.com](https://api.apify.com/v2/key-value-stores/ad2dUV2Kkxba6XhO1/records/LATEST?disableRedirect=true) or copy this url:

    https://api.apify.com/v2/key-value-stores/ad2dUV2Kkxba6XhO1/records/LATEST?disableRedirect=true
    
Tip: You can [explore API on jsonformatter.org](https://jsonformatter.org/json-viewer/?url=https://api.apify.com/v2/key-value-stores/ad2dUV2Kkxba6XhO1/records/LATEST?disableRedirect=true)

## Data Sources
- [MZČR](https://onemocneni-aktualne.mzcr.cz/covid-19), scrapped, not using their APIs
- [ČSSZ](https://www.cssz.cz/documents/20143/648807/Statistika_hlasene_karanteny_Z209-pocet_pripadu_souhrnne_za_2020_podle_kraju_a_okresu.xlsx/9d3b34d3-5df2-7fd5-264e-be89d267dae2), .xlsx file, parsed
- [Czech R0 Estimate](https://docs.google.com/spreadsheets/d/1cCCECunGrLmcxp5RwTRvHPLPi2Uh2J8b4NIoyFDcu7c/edit#gid=1683234482), authors: [Jan Netík](https://github.com/netique/corona), Honza Řasa, Jan Schubert
- [COVID-19 by districts from KHS](https://docs.google.com/spreadsheets/d/1FFEDhS6VMWon_AWkJrf8j3XxjZ4J6UI1B2lO3IW-EEc/edit#gid=1011737151), author: [Marek Lutonský](https://twitter.com/marekl/status/1243488115165204480)

## Data Schema
Can be found on [sablatura.info/covid/api](https://www.sablatura.info/covid/api/)

## Schedule
Every 8 hours.

## License
MIT. Feel free to reproduce and improve!
