#!/usr/bin/env groovy

/**
 * Script para crear automáticamente los pipelines en Jenkins
 * Ejecutar con: groovy create-pipelines.groovy
 */

import jenkins.model.Jenkins
import hudson.model.FreeStyleProject
import org.jenkinsci.plugins.workflow.job.WorkflowJob
import org.jenkinsci.plugins.workflow.cps.CpsScmFlowDefinition
import hudson.plugins.git.GitSCM
import hudson.plugins.git.BranchSpec

def jenkins = Jenkins.getInstance()

println "═══════════════════════════════════════════════════════════"
println "📦 Creando Pipelines en Jenkins"
println "═══════════════════════════════════════════════════════════"

// ============================================
// Pipeline 1: Auth Service
// ============================================
def authPipelineName = "auth-service-pipeline"
println "\n🔧 Creando pipeline: ${authPipelineName}"

if (jenkins.getItem(authPipelineName) != null) {
    println "⚠️  Pipeline '${authPipelineName}' ya existe, eliminando..."
    jenkins.getItem(authPipelineName).delete()
}

def authPipeline = jenkins.createProject(WorkflowJob.class, authPipelineName)
authPipeline.setDescription("Pipeline CI/CD para el servicio de autenticación (Node.js)")

// Configurar Git SCM
def authGitScm = new GitSCM("https://github.com/odiador/retos-microservicios.git")
authGitScm.branches = [new BranchSpec("*/automatizacion-04")]

// Configurar Pipeline desde SCM
def authScmDefinition = new CpsScmFlowDefinition(authGitScm, "auth/Jenkinsfile")
authScmDefinition.setLightweight(true)
authPipeline.setDefinition(authScmDefinition)

authPipeline.save()
println "✅ Pipeline '${authPipelineName}' creado exitosamente"

// ============================================
// Pipeline 2: Orchestrator Service
// ============================================
def orchestratorPipelineName = "orchestrator-pipeline"
println "\n🔧 Creando pipeline: ${orchestratorPipelineName}"

if (jenkins.getItem(orchestratorPipelineName) != null) {
    println "⚠️  Pipeline '${orchestratorPipelineName}' ya existe, eliminando..."
    jenkins.getItem(orchestratorPipelineName).delete()
}

def orchestratorPipeline = jenkins.createProject(WorkflowJob.class, orchestratorPipelineName)
orchestratorPipeline.setDescription("Pipeline CI/CD para el servicio orquestador (Java/Spring Boot)")

// Configurar Git SCM
def orchestratorGitScm = new GitSCM("https://github.com/odiador/retos-microservicios.git")
orchestratorGitScm.branches = [new BranchSpec("*/automatizacion-04")]

// Configurar Pipeline desde SCM
def orchestratorScmDefinition = new CpsScmFlowDefinition(orchestratorGitScm, "notiorchestrator/Jenkinsfile")
orchestratorScmDefinition.setLightweight(true)
orchestratorPipeline.setDefinition(orchestratorScmDefinition)

orchestratorPipeline.save()
println "✅ Pipeline '${orchestratorPipelineName}' creado exitosamente"

// ============================================
// Guardar configuración
// ============================================
jenkins.save()

println "\n═══════════════════════════════════════════════════════════"
println "✅ Pipelines creados exitosamente!"
println "═══════════════════════════════════════════════════════════"
println "\n📋 Pipelines disponibles:"
println "  • ${authPipelineName}"
println "  • ${orchestratorPipelineName}"
println "\n🔗 Accede a Jenkins en: http://localhost:8090/jenkins"
println "═══════════════════════════════════════════════════════════"
