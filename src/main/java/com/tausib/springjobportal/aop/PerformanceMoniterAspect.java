package com.tausib.springjobportal.aop;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
@Aspect
public class PerformanceMoniterAspect {

    private static final Logger LOGGER = LoggerFactory.getLogger(PerformanceMoniterAspect.class.getName());

    @Around("execution(* com.tausib.springjobportal.controller..*(..)) || execution(* com.tausib.springjobportal.service..*(..))")
    public Object monitorPerformance(ProceedingJoinPoint pjp) throws Throwable {
        long startTime = System.currentTimeMillis();
        Object result = pjp.proceed();
        long endTime = System.currentTimeMillis();
        LOGGER.info("Execution time of " + pjp.getSignature().getName() + " is " + (endTime - startTime) + "ms");
        return result;
    }

}
