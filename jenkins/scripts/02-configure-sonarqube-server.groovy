import jenkins.model.Jenkins
import hudson.plugins.sonar.SonarGlobalConfiguration
import hudson.plugins.sonar.SonarInstallation

def jenkins = Jenkins.instance

println "🔧 Configurando servidor SonarQube en Jenkins..."

// Obtener la configuración global de SonarQube
def sonarConfig = jenkins.getDescriptor(SonarGlobalConfiguration.class)

// Configurar la instalación de SonarQube
def sonarInstallation = new SonarInstallation(
    'SonarQube',                          // Nombre
    'http://sonarqube:9000',              // URL del servidor
    'sonarqube-token',                    // ID de la credencial
    null,                                  // Versión del servidor (auto-detectada)
    null,                                  // Opciones adicionales de Maven
    null,                                  // Propiedades adicionales
    null,                                  // Triggers
    null                                   // Webhook secret
)

// Establecer las instalaciones de SonarQube
sonarConfig.setInstallations(sonarInstallation)

// Guardar la configuración
sonarConfig.save()
jenkins.save()

println "✅ Servidor SonarQube configurado exitosamente"
println "   Nombre: SonarQube"
println "   URL: http://sonarqube:9000"
println "   Credencial: sonarqube-token"
