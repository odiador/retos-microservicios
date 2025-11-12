package com.microservicios.orchestrator;

import io.cucumber.junit.Cucumber;
import io.cucumber.junit.CucumberOptions;
import org.junit.runner.RunWith;

@RunWith(Cucumber.class)
@CucumberOptions(
        features = "classpath:features",
        glue = "com.microservicios.orchestrator.stepdefs",
        plugin = {"pretty", "json:target/cucumber-report.json"},
        monochrome = true
)
public class CucumberTestRunner {
        public CucumberTestRunner() {
                System.out.println("Cucumber Test Runner initialized");
        }
}
