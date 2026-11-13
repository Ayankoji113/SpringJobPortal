package com.tausib.springjobportal;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableCaching
@SpringBootApplication
@EnableAsync
@EnableScheduling
public class SpringJobPortalApplication {

    public static void main(String[] args) {
        SpringApplication.run(SpringJobPortalApplication.class, args);
    }
}
