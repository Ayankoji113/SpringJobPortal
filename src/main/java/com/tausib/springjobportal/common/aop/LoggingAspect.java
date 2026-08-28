package com.tausib.springjobportal.common.aop;

import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
@Aspect
public class LoggingAspect {

    private static final Logger LOGGER = LoggerFactory.getLogger(LoggingAspect.class);

    @Before("execution(* com.tausib.springjobportal..*Controller.*(..)) || execution(* com.tausib.springjobportal..*Service.*(..))")
    public void logMethodCall(JoinPoint jp){

        LOGGER.info("Method called" + jp.getSignature().getName());
    }
    @After("execution(* com.tausib.springjobportal..*Controller.*(..)) || execution(* com.tausib.springjobportal..*Service.*(..))")
    public void logMerthodExecuted(JoinPoint jp){
        LOGGER.info("Method executed" + jp.getSignature().getName());
    }
    @AfterThrowing(pointcut = "execution(* com.tausib.springjobportal..*Controller.*(..)) || execution(* com.tausib.springjobportal..*Service.*(..))", throwing = "ex")
    public void logMethodCrash(JoinPoint jp, Throwable ex){
        LOGGER.error("Method crashed" + jp.getSignature().getName() + "Exception: " + ex.getMessage());
    }
    @AfterReturning(pointcut = "execution(* com.tausib.springjobportal..*Controller.*(..)) || execution(* com.tausib.springjobportal..*Service.*(..))", returning = "result")
    public void logMethodReturn(JoinPoint jp, Object result){
        LOGGER.info("Method returned" + jp.getSignature().getName() + "Result: " + result);
    }
}
