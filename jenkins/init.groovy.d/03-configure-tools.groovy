#!groovy
import jenkins.model.Jenkins
import hudson.tools.InstallSourceProperty
import hudson.tools.ToolProperty
import hudson.tools.ToolPropertyDescriptor
import hudson.util.DescribableList
import hudson.plugins.gradle.*
import hudson.plugins.nodejs.*
import hudson.plugins.sonar.*
import hudson.plugins.sonar.model.TriggersConfig

def instance = Jenkins.getInstance()

println("=== Configurando herramientas en Jenkins ===")

// ============================================
// CONFIGURAR GRADLE
// ============================================
try {
    println("🔧 Configurando Gradle...")
    def gradleDesc = instance.getDescriptor("hudson.plugins.gradle.Gradle")
    
    def gradleInstallations = [
        new GradleInstallation(
            "Gradle8",                                      // name
            "",                                             // home (auto-install)
            [new InstallSourceProperty([
                new GradleInstaller("8.4")
            ])]
        )
    ] as GradleInstallation[]
    
    gradleDesc.setInstallations(gradleInstallations)
    gradleDesc.save()
    println("✅ Gradle 8.4 configurado")
} catch (Exception e) {
    println("⚠️ Error configurando Gradle: ${e.message}")
}

// ============================================
// CONFIGURAR NODE.JS
// ============================================
try {
    println("🔧 Configurando Node.js...")
    def nodejsDesc = instance.getDescriptor("hudson.plugins.nodejs.tools.NodeJSInstallation")
    
    def nodejsInstallations = [
        new NodeJSInstallation(
            "NodeJS18",                                    // name
            "",                                            // home (auto-install)
            [new InstallSourceProperty([
                new NodeJSInstaller("18.20.4", "", 72)     // version, npmPackages, npmPackagesRefreshHours
            ])]
        )
    ] as NodeJSInstallation[]
    
    nodejsDesc.setInstallations(nodejsInstallations)
    nodejsDesc.save()
    println("✅ Node.js 18 configurado")
} catch (Exception e) {
    println("⚠️ Error configurando Node.js: ${e.message}")
}

// ============================================
// CONFIGURAR SONARQUBE
// ============================================
try {
    println("🔧 Configurando SonarQube...")
    def sonarDesc = instance.getDescriptor("hudson.plugins.sonar.SonarGlobalConfiguration")
    
    def sonarInstallations = [
        new SonarInstallation(
            "SonarQube",                                   // name
            "http://sonarqube:9000",                       // serverUrl
            "",                                            // sonarLogin (token)
            "",                                            // sonarPassword (deprecated)
            "",                                            // mojoVersion
            "",                                            // additionalProperties
            new TriggersConfig(),                          // triggers
            ""                                             // additionalAnalysisProperties
        )
    ] as SonarInstallation[]
    
    sonarDesc.setInstallations(sonarInstallations)
    sonarDesc.save()
    println("✅ SonarQube configurado en http://sonarqube:9000")
} catch (Exception e) {
    println("⚠️ Error configurando SonarQube: ${e.message}")
}

// ============================================
// CONFIGURAR JDK
// ============================================
try {
    println("🔧 Configurando JDK...")
    // JDK21 ya viene en la imagen jenkins/jenkins:lts-jdk21
    // Solo necesitamos configurarlo como herramienta disponible
    def jdkDesc = instance.getDescriptor("hudson.model.JDK")
    if (jdkDesc != null) {
        println("✅ JDK 21 disponible en la imagen")
    }
} catch (Exception e) {
    println("⚠️ Error verificando JDK: ${e.message}")
}

instance.save()

println("✅ Configuración de herramientas completada")
