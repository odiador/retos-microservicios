#!groovy
import jenkins.model.*
import hudson.security.*
import jenkins.security.s2m.AdminWhitelistRule

def instance = Jenkins.getInstance()

println("=== Configurando usuario administrador de Jenkins ===")

// Obtener credenciales desde variables de entorno
def adminUsername = System.getenv("JENKINS_ADMIN_ID") ?: "admin"
def adminPassword = System.getenv("JENKINS_ADMIN_PASSWORD") ?: "admin123"

// Crear HudsonPrivateSecurityRealm con usuario admin
def hudsonRealm = new HudsonPrivateSecurityRealm(false)
hudsonRealm.createAccount(adminUsername, adminPassword)
instance.setSecurityRealm(hudsonRealm)

// Configurar estrategia de autorización
def strategy = new FullControlOnceLoggedInStrategy()
strategy.setAllowAnonymousRead(false)
instance.setAuthorizationStrategy(strategy)

// Deshabilitar agentes antiguos para seguridad
instance.getInjector().getInstance(AdminWhitelistRule.class).setMasterKillSwitch(false)

// Guardar configuración
instance.save()

println("✅ Usuario administrador configurado: ${adminUsername}")
println("✅ Seguridad habilitada correctamente")
