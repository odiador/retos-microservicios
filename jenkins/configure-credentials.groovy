#!/usr/bin/env groovy

/**
 * Script para configurar credenciales de SonarQube en Jenkins
 */

import jenkins.model.Jenkins
import com.cloudbees.plugins.credentials.*
import com.cloudbees.plugins.credentials.impl.*
import com.cloudbees.plugins.credentials.domains.*
import hudson.util.Secret

def jenkins = Jenkins.getInstance()
def domain = Domain.global()
def store = jenkins.getExtensionList('com.cloudbees.plugins.credentials.SystemCredentialsProvider')[0].getStore()

println "═══════════════════════════════════════════════════════════"
println "🔐 Configurando Credenciales en Jenkins"
println "═══════════════════════════════════════════════════════════"

// Leer token de SonarQube desde archivo
def sonarToken = ""
try {
    def tokenFile = new File("/var/jenkins_home/sonarqube-token.txt")
    if (tokenFile.exists()) {
        sonarToken = tokenFile.text.trim()
        println "\n✅ Token de SonarQube leído desde archivo"
    } else {
        // Si no existe el archivo, usar valor de ejemplo
        sonarToken = System.getenv("SONAR_TOKEN") ?: "sqa_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
        println "\n⚠️  Archivo de token no encontrado, usando valor de entorno"
    }
} catch (Exception e) {
    println "\n⚠️  Error leyendo token: ${e.message}"
    sonarToken = "sqa_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
}

// Eliminar credencial existente si existe
def existingCreds = store.getCredentials(domain).find { it.id == 'sonarqube-token' }
if (existingCreds) {
    println "\n🗑️  Eliminando credencial existente..."
    store.removeCredentials(domain, existingCreds)
}

// Crear nueva credencial de SonarQube
def sonarCredential = new StringCredentialsImpl(
    CredentialsScope.GLOBAL,
    "sonarqube-token",
    "SonarQube Authentication Token for Jenkins",
    Secret.fromString(sonarToken)
)

store.addCredentials(domain, sonarCredential)

println "✅ Credencial 'sonarqube-token' configurada"
println "   Token: ${sonarToken.substring(0, 10)}..."

jenkins.save()

println "\n═══════════════════════════════════════════════════════════"
println "✅ Credenciales configuradas exitosamente!"
println "═══════════════════════════════════════════════════════════"
