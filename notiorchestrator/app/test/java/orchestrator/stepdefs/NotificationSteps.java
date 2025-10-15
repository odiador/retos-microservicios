package com.microservicios.orchestrator.stepdefs;
import io.cucumber.java.en.*;
import io.restassured.RestAssured;
import io.restassured.response.Response;
import static io.restassured.module.jsv.JsonSchemaValidator.matchesJsonSchemaInClasspath;

import java.util.HashMap;
import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

public class NotificationSteps {

    private Response response;
    private Map<String, Object> requestBody = new HashMap<>();

    @Given("el orquestador está en ejecución en {string}")
    public void el_orquestador_esta_en_ejecucion(String baseUrl) {
        RestAssured.baseURI = baseUrl;
    }

    @When("recibo un evento {string} con:")
    public void recibo_un_evento_con(String eventType, io.cucumber.datatable.DataTable dataTable) {
        requestBody.clear();
        requestBody.put("eventType", eventType);
        requestBody.putAll(dataTable.asMap(String.class, String.class));

        response = given()
                .header("Content-Type", "application/json")
                .body(requestBody)
                .when()
                .post("/events"); 
    }

    @Then("debo publicar una notificación de tipo {string} a {string}")
    public void debo_publicar_una_notificacion(String type, String destination) {
        response.then()
                .statusCode(200)
                // validate whole response against JSON Schema
                .assertThat().body(matchesJsonSchemaInClasspath("schemas/notifications-schema.json"))
                .body("notifications.find { it.type == '" + type + "' }.to", equalTo(destination));
    }

    @Then("no debo publicar ninguna notificación de tipo {string}")
    public void no_debo_publicar_notificacion(String type) {
        response.then()
                .statusCode(200)
                // validate response schema
                .assertThat().body(matchesJsonSchemaInClasspath("schemas/notifications-schema.json"))
                .body("notifications.findAll { it.type == '" + type + "' }", hasSize(0));
    }
}
