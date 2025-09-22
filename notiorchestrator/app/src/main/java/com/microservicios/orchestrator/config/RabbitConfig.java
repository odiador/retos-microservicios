package com.microservicios.orchestrator.config;

import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.annotation.EnableRabbit;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableRabbit
public class RabbitConfig {

    @Value("${orchestrator.exchange}")
    private String authEventsExchange;

    @Value("${orchestrator.queues.input}")
    private String orchestratorQueue;

    @Value("${orchestrator.routing-keys.user}")
    private String userRoutingKey;

    @Value("${orchestrator.routing-keys.password}")
    private String passwordRoutingKey;

    @Bean
    public TopicExchange authEventsExchange() {
        return new TopicExchange(authEventsExchange, true, false);
    }

    @Bean
    public Queue orchestratorQueue() {
        return QueueBuilder.durable(orchestratorQueue).build();
    }

    @Bean
    public Binding userEventsBinding() {
        return BindingBuilder
                .bind(orchestratorQueue())
                .to(authEventsExchange())
                .with(userRoutingKey);
    }

    @Bean
    public Binding passwordEventsBinding() {
        return BindingBuilder
                .bind(orchestratorQueue())
                .to(authEventsExchange())
                .with(passwordRoutingKey);
    }

    @Bean
    public MessageConverter messageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(messageConverter());
        return template;
    }
}
