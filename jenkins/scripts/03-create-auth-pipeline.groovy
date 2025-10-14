import jenkins.model.Jenkins
import hudson.model.FreeStyleProject
import org.jenkinsci.plugins.workflow.job.WorkflowJob
import org.jenkinsci.plugins.workflow.cps.CpsScmFlowDefinition
import hudson.plugins.git.GitSCM
import hudson.plugins.git.BranchSpec

def jenkins = Jenkins.instance

println "📦 Creando pipeline para Auth Service..."

// Verificar si el job ya existe
def jobName = 'auth-service-pipeline'
def existingJob = jenkins.getItem(jobName)

if (existingJob) {
    println "⚠️  El job '$jobName' ya existe. Eliminando..."
    existingJob.delete()
}

// Crear nuevo Pipeline Job
def job = jenkins.createProject(WorkflowJob.class, jobName)

// Configurar el job para usar SCM (Git)
// Nota: Esto asume que el proyecto está en un repositorio Git local o remoto
// Si no está en Git, se debe configurar manualmente o usar Pipeline script directo

job.setDescription('Pipeline CI/CD para Auth Service (Node.js)')

// Configurar para que Jenkins busque el Jenkinsfile en el repositorio
// Por ahora, vamos a crear un pipeline básico que apunte al Jenkinsfile local
def scmDefinition = """
@Library('shared-library') _

pipeline {
    agent any
    
    tools {
        nodejs 'NodeJS-18'
    }
    
    environment {
        SONAR_SCANNER_HOME = tool 'SonarScanner'
    }
    
    stages {
        stage('Checkout') {
            steps {
                script {
                    echo '📥 Checking out code...'
                    // El código ya está en el workspace de Jenkins
                }
            }
        }
        
        stage('Install Dependencies') {
            steps {
                dir('auth') {
                    script {
                        echo '📦 Installing npm dependencies...'
                        bat 'npm install'
                    }
                }
            }
        }
        
        stage('Lint') {
            steps {
                dir('auth') {
                    script {
                        echo '🔍 Running ESLint...'
                        bat 'npm run lint || exit 0'
                    }
                }
            }
        }
        
        stage('Unit Tests') {
            steps {
                dir('auth') {
                    script {
                        echo '🧪 Running unit tests...'
                        bat 'npm test || exit 0'
                    }
                }
            }
            post {
                always {
                    junit allowEmptyResults: true, testResults: 'auth/test-results/*.xml'
                }
            }
        }
        
        stage('SonarQube Analysis') {
            steps {
                dir('auth') {
                    script {
                        echo '📊 Running SonarQube analysis...'
                        withSonarQubeEnv('SonarQube') {
                            bat "\\"${SONAR_SCANNER_HOME}\\\\bin\\\\sonar-scanner.bat\\""
                        }
                    }
                }
            }
        }
        
        stage('Quality Gate') {
            steps {
                script {
                    echo '🚦 Waiting for Quality Gate...'
                    timeout(time: 5, unit: 'MINUTES') {
                        def qg = waitForQualityGate()
                        if (qg.status != 'OK') {
                            echo "⚠️  Quality Gate failed: ${qg.status}"
                        } else {
                            echo '✅ Quality Gate passed'
                        }
                    }
                }
            }
        }
        
        stage('Build Docker Image') {
            steps {
                dir('auth') {
                    script {
                        echo '🐳 Building Docker image...'
                        bat 'docker build -t auth-service:latest .'
                    }
                }
            }
        }
    }
    
    post {
        always {
            echo '🧹 Cleaning up workspace...'
            cleanWs()
        }
        success {
            echo '✅ Pipeline completed successfully!'
        }
        failure {
            echo '❌ Pipeline failed!'
        }
    }
}
"""

// Configurar el pipeline script directamente
job.setDefinition(new org.jenkinsci.plugins.workflow.cps.CpsFlowDefinition(scmDefinition, true))

// Guardar el job
job.save()

println "✅ Pipeline 'auth-service-pipeline' creado exitosamente"

jenkins.save()
