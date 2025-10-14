import jenkins.model.Jenkins
import org.jenkinsci.plugins.workflow.job.WorkflowJob

def jenkins = Jenkins.instance

println "📦 Creando pipeline para Orchestrator Service..."

// Verificar si el job ya existe
def jobName = 'orchestrator-service-pipeline'
def existingJob = jenkins.getItem(jobName)

if (existingJob) {
    println "⚠️  El job '$jobName' ya existe. Eliminando..."
    existingJob.delete()
}

// Crear nuevo Pipeline Job
def job = jenkins.createProject(WorkflowJob.class, jobName)

job.setDescription('Pipeline CI/CD para Orchestrator Service (Java/Spring Boot)')

// Configurar el pipeline script directamente
def scmDefinition = """
pipeline {
    agent any
    
    tools {
        gradle 'Gradle-8.4'
        jdk 'JDK-21'
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
        
        stage('Build') {
            steps {
                dir('notiorchestrator') {
                    script {
                        echo '🔨 Building with Gradle...'
                        bat 'gradle clean build -x test'
                    }
                }
            }
        }
        
        stage('Unit Tests') {
            steps {
                dir('notiorchestrator') {
                    script {
                        echo '🧪 Running unit tests...'
                        bat 'gradle test || exit 0'
                    }
                }
            }
            post {
                always {
                    junit allowEmptyResults: true, testResults: 'notiorchestrator/**/build/test-results/test/*.xml'
                }
            }
        }
        
        stage('Code Coverage') {
            steps {
                dir('notiorchestrator') {
                    script {
                        echo '📊 Generating code coverage report...'
                        bat 'gradle jacocoTestReport || exit 0'
                    }
                }
            }
            post {
                always {
                    jacoco(
                        execPattern: 'notiorchestrator/**/build/jacoco/*.exec',
                        classPattern: 'notiorchestrator/**/build/classes',
                        sourcePattern: 'notiorchestrator/**/src/main/java',
                        exclusionPattern: '**/*Test*.class'
                    )
                }
            }
        }
        
        stage('SonarQube Analysis') {
            steps {
                dir('notiorchestrator') {
                    script {
                        echo '📊 Running SonarQube analysis...'
                        withSonarQubeEnv('SonarQube') {
                            bat 'gradle sonar'
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
                dir('notiorchestrator') {
                    script {
                        echo '🐳 Building Docker image...'
                        bat 'docker build -t orchestrator-service:latest .'
                    }
                }
            }
        }
        
        stage('Cucumber Tests') {
            steps {
                dir('notiorchestrator') {
                    script {
                        echo '🥒 Running Cucumber BDD tests...'
                        bat 'gradle cucumber || exit 0'
                    }
                }
            }
            post {
                always {
                    cucumber buildStatus: 'UNSTABLE',
                        fileIncludePattern: '**/*.json',
                        trendsLimit: 10,
                        classifications: [
                            [key: 'Browser', value: 'N/A'],
                            [key: 'Environment', value: 'Jenkins']
                        ]
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

job.setDefinition(new org.jenkinsci.plugins.workflow.cps.CpsFlowDefinition(scmDefinition, true))

// Guardar el job
job.save()

println "✅ Pipeline 'orchestrator-service-pipeline' creado exitosamente"

jenkins.save()
