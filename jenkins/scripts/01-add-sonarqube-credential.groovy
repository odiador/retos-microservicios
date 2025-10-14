import jenkins.model.Jenkins
import com.cloudbees.plugins.credentials.CredentialsScope
import com.cloudbees.plugins.credentials.domains.Domain
import com.cloudbees.plugins.credentials.SystemCredentialsProvider
import org.jenkinsci.plugins.plaincredentials.impl.StringCredentialsImpl

def jenkins = Jenkins.instance

// Leer el token de SonarQube desde el archivo
def tokenFile = new File('/var/jenkins_home/sonarqube-token.txt')
def sonarToken = tokenFile.exists() ? tokenFile.text.trim() : 'sqa_69208386ed8c91bcd25f94fd5a041f354e25ff97'

println "🔐 Configurando credencial de SonarQube..."

// Crear credencial de tipo Secret Text
def credentials = new StringCredentialsImpl(
    CredentialsScope.GLOBAL,
    'sonarqube-token',
    'SonarQube Authentication Token',
    hudson.util.Secret.fromString(sonarToken)
)

// Obtener el almacén de credenciales del sistema
def credentialsStore = SystemCredentialsProvider.getInstance().getStore()

// Verificar si la credencial ya existe
def domain = Domain.global()
def existingCreds = credentialsStore.getCredentials(domain)
def credentialExists = existingCreds.find { it.id == 'sonarqube-token' }

if (credentialExists) {
    println "⚠️  La credencial 'sonarqube-token' ya existe. Eliminando la anterior..."
    credentialsStore.removeCredentials(domain, credentialExists)
}

// Agregar la nueva credencial
credentialsStore.addCredentials(domain, credentials)

println "✅ Credencial 'sonarqube-token' configurada exitosamente"
println "   ID: sonarqube-token"
println "   Descripción: SonarQube Authentication Token"
println "   Scope: GLOBAL"

jenkins.save()
println "✅ Configuración guardada"
