package com.tausib.springjobportal.common.aop;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
@Aspect
public class PerformanceMonitorAspect {

    private static final Logger LOGGER = LoggerFactory.getLogger(PerformanceMonitorAspect.class.getName());

    @Around("execution(* com.tausib.springjobportal..*Controller.*(..)) || execution(* com.tausib.springjobportal..*Service.*(..))")
    public Object monitorPerformance(ProceedingJoinPoint pjp) throws Throwable {
        long startTime = System.currentTimeMillis();
        Object result = pjp.proceed();
        long endTime = System.currentTimeMillis();
        LOGGER.info("Execution time of " + pjp.getSignature().getName() + " is " + (endTime - startTime) + "ms");
        return result;
    }

}
