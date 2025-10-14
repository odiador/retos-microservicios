#!groovy
import jenkins.model.Jenkins
import hudson.model.UpdateSite
import hudson.PluginWrapper
import hudson.PluginManager

def instance = Jenkins.getInstance()
def pm = instance.getPluginManager()
def uc = instance.getUpdateCenter()

println("=== Instalando plugins esenciales para Jenkins ===")

// Lista de plugins necesarios para CI/CD
def plugins = [
    "git",                          // Git integration
    "workflow-aggregator",          // Pipeline suite
    "docker-workflow",              // Docker integration
    "pipeline-stage-view",          // Pipeline visualization
    "blueocean",                    // Modern UI
    "sonar",                        // SonarQube integration
    "cucumber-reports",             // Cucumber reports
    "htmlpublisher",                // HTML reports
    "junit",                        // JUnit reports
    "jacoco",                       // Java code coverage
    "nodejs",                       // Node.js support
    "gradle",                       // Gradle support
    "credentials-binding",          // Credentials management
    "ssh-agent",                    // SSH support
    "timestamper",                  // Timestamps in logs
    "ws-cleanup",                   // Workspace cleanup
    "build-timeout",                // Build timeout
    "github",                       // GitHub integration
    "email-ext",                    // Extended email notifications
    "mailer",                       // Email notifications
    "ansicolor",                    // ANSI color in logs
    "json-path-api"                 // JSON processing
]

// Actualizar el update center
println("📥 Actualizando catálogo de plugins...")
uc.updateAllSites()

// Esperar a que se actualice
while (uc.getJobs().size() > 0) {
    Thread.sleep(1000)
}

// Instalar plugins
def installed = false
plugins.each { pluginName ->
    if (!pm.getPlugin(pluginName)) {
        println("📦 Instalando plugin: ${pluginName}")
        def plugin = uc.getPlugin(pluginName)
        if (plugin) {
            try {
                def installFuture = plugin.deploy()
                installFuture.get()
                installed = true
                println("✅ Plugin ${pluginName} instalado correctamente")
            } catch (Exception e) {
                println("⚠️ Error al instalar ${pluginName}: ${e.message}")
            }
        } else {
            println("⚠️ Plugin ${pluginName} no encontrado en el update center")
        }
    } else {
        println("✓ Plugin ${pluginName} ya está instalado")
    }
}

if (installed) {
    println("🔄 Plugins instalados. Jenkins se reiniciará para aplicar cambios...")
    instance.safeRestart()
} else {
    println("✅ Todos los plugins ya están instalados")
}

instance.save()
