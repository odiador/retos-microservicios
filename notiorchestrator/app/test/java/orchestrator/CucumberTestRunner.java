package com.microservicios.orchestrator;

import io.cucumber.junit.Cucumber;
import io.cucumber.junit.CucumberOptions;
import org.junit.runner.RunWith;

@RunWith(Cucumber.class)
@CucumberOptions(
        features = "src/test/resources/features",
        glue = "test.java.orchestrator.stepdefs", //creo que está mal, después miro
        plugin = {"pretty", "json:target/cucumber-report.json"},
        monochrome = true
)
public class CucumberTestRunner {
}
